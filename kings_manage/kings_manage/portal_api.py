# Copyright (c) 2026, Kings Solution and contributors
# For license information, please see license.txt

"""Whitelisted endpoints for the rental-portal SPA.

Everything here is either called by a guest (an applicant who has no account
yet, scoped by a single-use/limited-life Portal Access Token) or by a signed-in
Tenant user (scoped by frappe.session.user via Lease.tenant). No endpoint here
exposes the desk/list-view of any doctype - each one returns only the caller's
own data.
"""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.workflow import apply_workflow
from frappe.utils import now_datetime
from frappe.rate_limiter import rate_limit
from frappe.utils.file_manager import save_file

from kings_manage.kings_manage.doctype.portal_access_token.portal_access_token import (
	get_active_token,
	issue_token,
	notify,
)
from kings_manage.kings_manage.scope import (
	NOBODY,
	UNRESTRICTED,
	assert_owns,
	get_landlord,
	property_condition,
)


@frappe.whitelist()
def get_my_roles() -> list[str]:
	"""The generic User-doc fetch the SPA uses for the logged-in profile is
	field-permission-filtered, so a Website User's own `roles` child table
	comes back empty. This is a reliable, unfiltered source for the SPA's
	role-based navigation instead."""
	if frappe.session.user == "Guest":
		return []
	return frappe.get_roles(frappe.session.user)


@frappe.whitelist(allow_guest=True)
def get_available_units(property: str | None = None) -> list[dict]:
	"""Vacant, bookable units - optionally scoped to one parent property."""
	filters = {"status": "Vacant"}
	if property:
		filters["property"] = property

	return frappe.get_all(
		"Unit",
		filters=filters,
		fields=["name", "unit_number", "floor", "property", "unit_type", "rent_amount"],
		order_by="property, floor, unit_number",
		ignore_permissions=True,
	)


@frappe.whitelist(allow_guest=True)
def get_property(name: str) -> dict:
	"""A single unit's public detail, for the property detail/booking pages."""
	unit = frappe.get_doc("Unit", name)
	property_doc = frappe.get_doc("Property", unit.property) if unit.property else None

	return {
		"name": unit.name,
		"unit_number": unit.unit_number,
		"floor": unit.floor,
		"unit_type": unit.unit_type,
		"rent_amount": unit.rent_amount,
		"status": unit.status,
		"property": unit.property,
		"address": property_doc.address if property_doc else None,
		"county": property_doc.county if property_doc else None,
	}


@frappe.whitelist(allow_guest=True, methods=["POST"])
def submit_property_interest(
	property: str,
	full_name: str,
	phone: str,
	email: str,
	id_passport_number: str | None = None,
	move_in_date: str | None = None,
) -> dict:
	"""Public "I'm interested in this house" form. Creates the Customer and the
	Lease (auto-advanced to Submitted, which is also the tenant's application
	and, once approved, their live tenancy record), reserves the unit, and
	emails the applicant their single tracking link."""
	status = frappe.db.get_value("Unit", property, "status")
	if status != "Vacant":
		frappe.throw(_("This unit is no longer available."))

	# Everything below is trusted, validated, server-side logic - a guest has
	# no session privileges of their own, but Frappe's workflow engine checks
	# the *current session user's* read permission even on an internal save,
	# so this has to run as a privileged user regardless of the
	# ignore_permissions flags set on the document itself.
	original_user = frappe.session.user
	frappe.set_user("Administrator")
	try:
		return _create_application(property, full_name, phone, email, id_passport_number, move_in_date)
	finally:
		frappe.set_user(original_user)


def _create_application(
	property: str,
	full_name: str,
	phone: str,
	email: str,
	id_passport_number: str | None,
	move_in_date: str | None,
) -> dict:
	customer = _get_or_create_customer(full_name, phone, email)
	rent_amount = frappe.db.get_value("Unit", property, "rent_amount") or 0

	lease = frappe.new_doc("Lease")
	lease.tenant_name = full_name
	lease.customer = customer
	lease.unit = property
	lease.start_date = move_in_date or frappe.utils.nowdate()
	lease.rent_amount = rent_amount
	lease.deposit_amount = rent_amount
	lease.id_passport_number = id_passport_number
	lease.insert(ignore_permissions=True)

	lease.status = "Submitted"
	lease.flags.ignore_permissions = True
	lease.save()

	token_doc = issue_token(lease.name)
	notify(
		token_doc,
		full_name,
		email,
		"We've received your application",
		"Thanks for your interest! You can track your application here, and this same link "
		"will let you upload your deposit payment proof and (once approved) set up your account:",
	)

	# Returned directly (not just emailed) so the browser can move straight to
	# the tracking page even if no outgoing Email Account is configured yet.
	return {"lease": lease.name, "token": token_doc.token}


@frappe.whitelist(methods=["POST"])
def register_tenant(
	unit: str,
	full_name: str,
	phone: str,
	email: str,
	id_passport_number: str | None = None,
	move_in_date: str | None = None,
) -> dict:
	"""Landlord/Caretaker registers a walk-in tenant for a vacant unit
	directly from the portal, instead of the tenant applying online
	themselves. Goes through the exact same application workflow as a public
	application (Submitted -> KYC Verification -> Awaiting Deposit -> Active)
	- it does not skip approval."""
	_require_staff()
	assert_owns("Unit", unit)

	if frappe.db.get_value("Unit", unit, "status") != "Vacant":
		frappe.throw(_("This unit is not vacant."))

	# Same permission-check quirk as the guest application flow: Frappe's
	# workflow engine checks the *session user's* read permission even on an
	# internal save, regardless of ignore_permissions on the document.
	original_user = frappe.session.user
	frappe.set_user("Administrator")
	try:
		return _create_application(unit, full_name, phone, email, id_passport_number, move_in_date)
	finally:
		frappe.set_user(original_user)


@frappe.whitelist(allow_guest=True)
def get_application_status(token: str) -> dict:
	token_doc = get_active_token(token)
	lease = frappe.get_doc("Lease", token_doc.lease)
	return {
		"status": lease.status,
		"rejection_reason": lease.rejection_reason if lease.status == "Rejected" else None,
		"can_submit_deposit": lease.status == "Awaiting Deposit",
		"can_register": lease.status == "Active",
		"is_registered": bool(lease.tenant),
	}


@frappe.whitelist(allow_guest=True, methods=["POST"])
def submit_deposit_proof(token: str, reference: str | None = None) -> dict:
	token_doc = get_active_token(token)
	lease = frappe.get_doc("Lease", token_doc.lease)
	if lease.status != "Awaiting Deposit":
		frappe.throw(_("We are not ready to accept your deposit payment yet."))

	if reference:
		lease.db_set("deposit_reference", reference)

	uploaded = frappe.request.files.get("file") if frappe.request else None
	if uploaded:
		saved = save_file(
			uploaded.filename, uploaded.stream.read(), "Lease", lease.name, is_private=1
		)
		lease.db_set("deposit_proof", saved.file_url)

	if not reference and not uploaded:
		frappe.throw(_("Please provide a payment reference or attach proof of payment."))

	return {"status": lease.status}


@frappe.whitelist(allow_guest=True, methods=["POST"])
def complete_registration(token: str, password: str) -> dict:
	token_doc = get_active_token(token)
	lease = frappe.get_doc("Lease", token_doc.lease)
	if lease.status != "Active":
		frappe.throw(_("Your application hasn't been approved yet."))
	if lease.tenant:
		frappe.throw(_("An account has already been created for this application."))

	email = frappe.db.get_value("Customer", lease.customer, "email_id")
	if not email:
		frappe.throw(_("No email address is on file for this application."))

	name_parts = lease.tenant_name.split(" ", 1)
	first_name = name_parts[0]
	last_name = name_parts[1] if len(name_parts) > 1 else ""

	if frappe.db.exists("User", email):
		user = frappe.get_doc("User", email)
	else:
		user = frappe.new_doc("User")
		user.email = email
		user.first_name = first_name
		user.last_name = last_name
		user.send_welcome_email = 0
		user.insert(ignore_permissions=True)

	# Force these even on a reused User (ERPNext auto-creates a portal login,
	# defaulting to System User, the moment a Customer gets an email address) -
	# a tenant must never end up with desk/admin access.
	user.user_type = "Website User"
	if not any(r.role == "Tenant" for r in user.roles):
		user.append("roles", {"role": "Tenant"})
	for role in list(user.roles):
		if role.role != "Tenant":
			user.roles.remove(role)

	user.new_password = password
	user.flags.ignore_permissions = True
	user.save(ignore_permissions=True)

	lease.db_set("tenant", user.name)
	token_doc.db_set("status", "Used")

	from frappe.auth import LoginManager

	if not getattr(frappe.local, "login_manager", None):
		frappe.local.login_manager = LoginManager()
	frappe.local.login_manager.login_as(user.name)

	return {"user": user.name}


@frappe.whitelist()
def get_my_contract() -> dict | None:
	lease = _current_lease()
	name = frappe.db.get_value("Contract", {"lease": lease.name}, "name", order_by="creation desc")
	if not name:
		return None

	contract = frappe.get_doc("Contract", name)
	return {
		"name": contract.name,
		"status": contract.status,
		"docstatus": contract.docstatus,
		"is_signed": contract.is_signed,
		"start_date": contract.start_date,
		"end_date": contract.end_date,
		"contract_terms": contract.contract_terms,
		"signed_on": contract.signed_on,
		"signed_document": contract.get("signed_document"),
		"has_lease_document": bool(contract.get("lease_document")),
	}


@frappe.whitelist(methods=["POST"])
def sign_contract(contract: str, signee_name: str) -> dict:
	lease = _current_lease()
	doc = frappe.get_doc("Contract", contract)
	if doc.lease != lease.name:
		frappe.throw(_("You are not permitted to sign this contract."), frappe.PermissionError)
	if doc.is_signed:
		frappe.throw(_("This contract has already been signed."))

	doc.is_signed = 1
	doc.signee = signee_name
	doc.signed_on = now_datetime()
	doc.ip_address = frappe.local.request_ip
	doc.flags.ignore_permissions = True
	doc.save()
	doc.submit()

	return {"status": doc.status}


@frappe.whitelist(methods=["POST"])
def upload_signed_contract(contract: str, signee_name: str | None = None) -> dict:
	"""Lets a tenant who signed a printed copy by hand attach the scanned/
	photographed document, instead of (or alongside) typing their name to
	e-sign. Attaching a copy also confirms the contract, the same as e-sign."""
	lease = _current_lease()
	doc = frappe.get_doc("Contract", contract)
	if doc.lease != lease.name:
		frappe.throw(_("You are not permitted to update this contract."), frappe.PermissionError)

	_attach_signed_copy(doc, signee_name or lease.tenant_name)
	return {"status": frappe.db.get_value("Contract", doc.name, "status")}


def _attach_signed_copy(doc: Document, signee_name: str) -> None:
	"""Attach the uploaded scan/photo of a hand-signed lease and, if the
	contract isn't signed yet, mark it signed and submit it."""
	uploaded = frappe.request.files.get("file") if frappe.request else None
	if not uploaded:
		frappe.throw(_("Please attach a copy of the signed contract."))

	saved = save_file(uploaded.filename, uploaded.stream.read(), "Contract", doc.name, is_private=1)
	doc.db_set("signed_document", saved.file_url)

	if not doc.is_signed:
		doc.reload()
		doc.is_signed = 1
		doc.signee = signee_name
		doc.signed_on = now_datetime()
		doc.ip_address = frappe.local.request_ip
		doc.flags.ignore_permissions = True
		doc.save()
		if doc.docstatus == 0:
			doc.submit()


@frappe.whitelist()
def get_my_dues() -> dict:
	lease = _current_lease()
	invoices = frappe.get_all(
		"Sales Invoice",
		filters={"customer": lease.customer, "docstatus": ["!=", 2]},
		fields=[
			"name",
			"posting_date",
			"due_date",
			"invoice_type",
			"grand_total",
			"outstanding_amount",
			"status",
		],
		order_by="posting_date desc",
	)
	return {"invoices": invoices}


@frappe.whitelist()
def get_my_dashboard() -> dict:
	"""One call for the whole tenant dashboard: lease/unit summary, the
	rent/water/deposit balances (a real Sales Invoice.invoice_type per
	invoice now, no more line-item guessing), and recent invoices."""
	lease = _current_lease()

	property_name = frappe.db.get_value("Unit", lease.unit, "property") if lease.unit else None

	invoices = frappe.get_all(
		"Sales Invoice",
		filters={"customer": lease.customer, "docstatus": ["!=", 2]},
		fields=["name", "posting_date", "invoice_type", "grand_total", "outstanding_amount", "status"],
		order_by="posting_date desc",
	)

	rent_balance = sum(i.outstanding_amount for i in invoices if i.invoice_type == "Rent")
	water_balance = sum(i.outstanding_amount for i in invoices if i.invoice_type == "Water Bill")
	deposit_invoices = [i for i in invoices if i.invoice_type == "Deposit"]
	deposit_amount = deposit_invoices[0].grand_total if deposit_invoices else (lease.deposit_amount or 0)
	deposit_paid = bool(deposit_invoices) and not deposit_invoices[0].outstanding_amount

	return {
		"unit": lease.unit,
		"property": property_name,
		"lease_status": lease.status,
		"rent_balance": rent_balance,
		"water_balance": water_balance,
		"deposit_amount": deposit_amount,
		"deposit_paid": deposit_paid,
		"recent_invoices": invoices[:5],
		"notice_given": lease.notice_given,
		"move_out_date": lease.move_out_date,
	}


@frappe.whitelist(methods=["POST"])
def submit_notice(move_out_date: str, reason: str | None = None) -> dict:
	"""Tenant gives notice to vacate their current, active lease."""
	lease = _current_lease()
	if lease.status != "Active":
		frappe.throw(_("Notice can only be given on an active lease."))
	if lease.notice_given:
		frappe.throw(_("You have already given notice on this lease."))

	lease.db_set("notice_given", 1)
	lease.db_set("notice_date", frappe.utils.nowdate())
	lease.db_set("move_out_date", move_out_date)
	lease.db_set("notice_reason", reason)

	return {"notice_given": 1, "move_out_date": move_out_date}


@frappe.whitelist(methods=["POST"])
def report_issue(subject: str, description: str, category: str | None = None) -> dict:
	lease = _current_lease()

	issue = frappe.new_doc("Issue")
	issue.subject = subject
	issue.description = description
	issue.category = category
	issue.customer = lease.customer
	issue.raised_by = frappe.session.user
	issue.unit = lease.unit
	issue.via_customer_portal = 1

	uploaded = frappe.request.files.get("file") if frappe.request else None
	issue.flags.ignore_permissions = True
	issue.insert()

	if uploaded:
		saved = save_file(uploaded.filename, uploaded.stream.read(), "Issue", issue.name, is_private=1)
		issue.db_set("photo", saved.file_url)

	return {"name": issue.name}


@frappe.whitelist()
def get_my_issues() -> list[dict]:
	lease = _current_lease()
	return frappe.get_all(
		"Issue",
		filters={"customer": lease.customer},
		fields=[
			"name",
			"subject",
			"status",
			"category",
			"opening_date",
			"photo",
			"resolution_details",
			"resolution_photo",
		],
		order_by="creation desc",
	)


def _require_staff() -> None:
	roles = frappe.get_roles()
	if "Landlord" not in roles and "Caretaker" not in roles and "System Manager" not in roles:
		frappe.throw(_("You are not permitted to do this."), frappe.PermissionError)


def _require_landlord() -> None:
	roles = frappe.get_roles()
	if "Landlord" not in roles and "System Manager" not in roles:
		frappe.throw(_("Only a Landlord can do this."), frappe.PermissionError)


@frappe.whitelist()
def get_admin_dashboard() -> dict:
	"""Landlord/Caretaker overview for the caller's own properties: expected
	vs collected rent for the current month, portfolio size, vacancy, and how
	many issues came in this month."""
	_require_staff()

	month_start = frappe.utils.get_first_day(frappe.utils.nowdate())
	month_end = frappe.utils.get_last_day(frappe.utils.nowdate())
	in_scope = property_condition("unit.property")

	def scalar(query: str, values: tuple = ()) -> float:
		return frappe.db.sql(query, values)[0][0] or 0

	return {
		"expected_monthly_rent": scalar(
			f"""
			select sum(lease.rent_amount) from `tabLease` lease
			join `tabUnit` unit on unit.name = lease.unit
			where lease.status = 'Active' and {in_scope}
			"""
		),
		"collected_rent_this_month": scalar(
			f"""
			select sum(invoice.grand_total) from `tabSales Invoice` invoice
			join `tabLease` lease on lease.name = invoice.lease
			join `tabUnit` unit on unit.name = lease.unit
			where invoice.invoice_type = 'Rent' and invoice.docstatus = 1
			and invoice.outstanding_amount = 0
			and invoice.posting_date between %s and %s and {in_scope}
			""",
			(month_start, month_end),
		),
		"property_count": scalar(
			f"select count(*) from `tabProperty` where {property_condition('name')}"
		),
		"unit_count": scalar(f"select count(*) from `tabUnit` unit where {in_scope}"),
		"vacant_count": scalar(
			f"select count(*) from `tabUnit` unit where unit.status = 'Vacant' and {in_scope}"
		),
		"issues_this_month": scalar(
			f"""
			select count(*) from `tabIssue` issue
			join `tabUnit` unit on unit.name = issue.unit
			where issue.opening_date between %s and %s and {in_scope}
			""",
			(month_start, month_end),
		),
		"notices_count": scalar(
			f"""
			select count(*) from `tabLease` lease
			join `tabUnit` unit on unit.name = lease.unit
			where lease.notice_given = 1 and lease.status = 'Active' and {in_scope}
			"""
		),
	}


@frappe.whitelist()
def get_notices() -> list[dict]:
	"""Every active lease a tenant has given notice on, in the caller's properties."""
	_require_staff()
	return frappe.db.sql(
		f"""
		select lease.name, lease.tenant_name, lease.unit, lease.notice_date,
		       lease.move_out_date, lease.notice_reason
		from `tabLease` lease
		join `tabUnit` unit on unit.name = lease.unit
		where lease.notice_given = 1 and lease.status = 'Active'
		and {property_condition("unit.property")}
		order by lease.move_out_date asc
		""",
		as_dict=True,
	)


@frappe.whitelist()
def get_properties() -> list[dict]:
	"""The caller's registered properties (every property for an administrator)."""
	_require_staff()
	return frappe.db.sql(
		f"""
		select name, property_name, property_type, address, county, landlord
		from `tabProperty`
		where {property_condition("name")}
		order by property_name
		""",
		as_dict=True,
	)


@frappe.whitelist(methods=["POST"])
def create_property(
	property_name: str,
	property_type: str | None = None,
	address: str | None = None,
	county: str | None = None,
) -> dict:
	"""Registers a new building/estate, owned by the calling landlord (or by
	the landlord of the calling caretaker)."""
	_require_staff()
	if get_landlord() == NOBODY:
		frappe.throw(_("Your account isn't linked to a landlord yet."), frappe.PermissionError)

	doc = frappe.new_doc("Property")
	doc.property_name = property_name
	doc.property_type = property_type
	doc.address = address
	doc.county = county
	doc.flags.ignore_permissions = True
	doc.insert()

	return {"name": doc.name}


@frappe.whitelist()
def get_units(property: str | None = None, status: str | None = None) -> list[dict]:
	"""Units (any status) in the caller's properties, optionally filtered."""
	_require_staff()

	conditions = [property_condition("unit.property")]
	values = {}
	if property:
		conditions.append("unit.property = %(property)s")
		values["property"] = property
	if status:
		conditions.append("unit.status = %(status)s")
		values["status"] = status

	return frappe.db.sql(
		f"""
		select unit.name, unit.unit_number, unit.floor, unit.property, unit.unit_type,
		       unit.rent_amount, unit.status
		from `tabUnit` unit
		where {" and ".join(conditions)}
		order by unit.property, unit.floor, unit.unit_number
		""",
		values,
		as_dict=True,
	)


@frappe.whitelist(methods=["POST"])
def create_unit(
	property: str,
	unit_number: str,
	floor: str | None = None,
	unit_type: str | None = None,
	rent_amount: float | None = None,
) -> dict:
	"""Registers a new house/unit under one of the caller's properties."""
	_require_staff()
	assert_owns("Property", property)

	doc = frappe.new_doc("Unit")
	doc.property = property
	doc.unit_number = unit_number
	doc.floor = floor
	doc.unit_type = unit_type
	doc.rent_amount = rent_amount
	doc.status = "Vacant"
	doc.flags.ignore_permissions = True
	doc.insert()

	return {"name": doc.name}


@frappe.whitelist()
def get_tenants(property: str | None = None) -> list[dict]:
	"""Every tenant/application in the caller's properties, optionally for one."""
	_require_staff()

	conditions = [property_condition("unit.property")]
	values = {}
	if property:
		conditions.append("unit.property = %(property)s")
		values["property"] = property

	return frappe.db.sql(
		f"""
		select lease.name, lease.tenant_name, lease.status, lease.rent_amount,
		       lease.unit, unit.property as property
		from `tabLease` lease
		join `tabUnit` unit on unit.name = lease.unit
		where {" and ".join(conditions)}
		order by lease.creation desc
		""",
		values,
		as_dict=True,
	)


@frappe.whitelist()
def get_applications(stage: str | None = None) -> list[dict]:
	"""Applications still moving through the Lease workflow, in the caller's
	properties - for Landlord/Caretaker to action from the portal, no
	ERPNext desk/workflow buttons needed."""
	_require_staff()

	conditions = [property_condition("unit.property")]
	values = {}
	if stage:
		conditions.append("lease.status = %(stage)s")
		values["stage"] = stage
	else:
		conditions.append("lease.status in ('Submitted', 'KYC Verification', 'Awaiting Deposit')")

	return frappe.db.sql(
		f"""
		select lease.name, lease.tenant_name, lease.status, lease.unit, unit.property as property,
		       lease.rent_amount, lease.deposit_amount, lease.deposit_reference, lease.deposit_proof,
		       lease.id_passport_number, lease.guarantor_name, lease.guarantor_phone, lease.creation
		from `tabLease` lease
		join `tabUnit` unit on unit.name = lease.unit
		where {" and ".join(conditions)}
		order by lease.creation asc
		""",
		values,
		as_dict=True,
	)


@frappe.whitelist(methods=["POST"])
def advance_application(
	lease: str,
	action: str,
	rejection_reason: str | None = None,
	deposit_reference: str | None = None,
) -> dict:
	"""Drive the Lease Application Workflow (Review / Approve / Confirm
	Deposit / Reject) from a single button in the portal, instead of
	requiring ERPNext desk access to use workflow action buttons."""
	_require_staff()
	assert_owns("Lease", lease)

	doc = frappe.get_doc("Lease", lease)
	# apply_workflow() reloads the doc from the database before checking the
	# transition's condition, so any field it needs (rejection_reason,
	# deposit_reference) must already be persisted, not just set in memory.
	if action == "Reject":
		if not rejection_reason:
			frappe.throw(_("Please provide a reason for rejecting this application."))
		doc.db_set("rejection_reason", rejection_reason)
	if action == "Confirm Deposit" and not (doc.deposit_reference or doc.deposit_proof):
		# The tenant may not have submitted anything online (e.g. a walk-in
		# who paid cash) - staff can just say "deposit paid" themselves.
		doc.db_set("deposit_reference", deposit_reference or "Confirmed by staff")

	apply_workflow(doc, action)
	return {"status": doc.status}


@frappe.whitelist()
def get_managed_issues(status: str | None = None) -> list[dict]:
	"""Issues across the caller's properties, for Landlord/Caretaker triage."""
	_require_staff()

	conditions = [property_condition("unit.property")]
	values = {}
	if status:
		conditions.append("issue.status = %(status)s")
		values["status"] = status

	return frappe.db.sql(
		f"""
		select issue.name, issue.subject, issue.description, issue.status, issue.category,
		       issue.unit, issue.customer, issue.opening_date, issue.photo,
		       issue.resolution_details, issue.resolution_photo
		from `tabIssue` issue
		join `tabUnit` unit on unit.name = issue.unit
		where {" and ".join(conditions)}
		order by issue.creation desc
		""",
		values,
		as_dict=True,
	)


@frappe.whitelist(methods=["POST"])
def resolve_issue(issue: str, resolution_details: str) -> dict:
	"""Caretaker/Landlord marks an issue resolved, with notes and an
	optional photo as proof of the fix."""
	_require_staff()
	assert_owns("Issue", issue)

	doc = frappe.get_doc("Issue", issue)
	doc.status = "Closed"
	doc.resolution_details = resolution_details
	doc.flags.ignore_permissions = True
	doc.save()

	uploaded = frappe.request.files.get("file") if frappe.request else None
	if uploaded:
		saved = save_file(uploaded.filename, uploaded.stream.read(), "Issue", doc.name, is_private=1)
		doc.db_set("resolution_photo", saved.file_url)

	return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def get_property_lease_documents() -> list[dict]:
	"""The caller's properties with their current lease document (if any) and
	how many tenant contracts each has, for the Contracts page."""
	_require_staff()
	properties = frappe.db.sql(
		f"""
		select name, property_name, lease_document from `tabProperty`
		where {property_condition("name")}
		order by property_name
		""",
		as_dict=True,
	)
	counts = dict(
		frappe.db.sql(
			f"""
			select unit.property, count(*)
			from `tabContract` contract
			join `tabLease` lease on lease.name = contract.lease
			join `tabUnit` unit on unit.name = lease.unit
			where {property_condition("unit.property")}
			group by unit.property
			"""
		)
	)
	for p in properties:
		p.lease_document_name = _file_name(p.lease_document)
		p.lease_document = bool(p.lease_document)
		p.contract_count = counts.get(p.name, 0)
	return properties


@frappe.whitelist(methods=["POST"])
def upload_property_lease_document(property: str) -> dict:
	"""Set or replace a building's standard lease document. Contracts already
	drawn up keep the copy they were created with."""
	_require_landlord()
	assert_owns("Property", property)
	uploaded = frappe.request.files.get("file") if frappe.request else None
	if not uploaded:
		frappe.throw(_("Please choose the lease document to upload."))

	doc = frappe.get_doc("Property", property)
	saved = save_file(uploaded.filename, uploaded.stream.read(), "Property", doc.name, is_private=1)
	doc.db_set("lease_document", saved.file_url)
	return {"name": doc.name, "lease_document_name": saved.file_name}


@frappe.whitelist()
def get_contracts(property: str | None = None) -> list[dict]:
	"""Every tenant contract in the caller's properties, with signed status."""
	_require_staff()

	conditions = [property_condition("unit.property")]
	values = {}
	if property:
		conditions.append("unit.property = %(property)s")
		values["property"] = property

	rows = frappe.db.sql(
		f"""
		select contract.name, contract.status, contract.is_signed, contract.signed_on,
		       contract.start_date, contract.end_date, contract.signed_document,
		       contract.lease_document, lease.tenant_name, lease.unit, unit.property
		from `tabContract` contract
		join `tabLease` lease on lease.name = contract.lease
		join `tabUnit` unit on unit.name = lease.unit
		where {" and ".join(conditions)}
		order by contract.creation desc
		""",
		values,
		as_dict=True,
	)
	for r in rows:
		r.signed_document = bool(r.signed_document)
		r.lease_document = bool(r.lease_document)
	return rows


@frappe.whitelist(methods=["POST"])
def upload_signed_contract_for_tenant(contract: str) -> dict:
	"""Staff attach a tenant's hand-signed paper lease on their behalf."""
	_require_landlord()
	assert_owns("Contract", contract)
	doc = frappe.get_doc("Contract", contract)
	tenant_name = frappe.db.get_value("Lease", doc.lease, "tenant_name") if doc.lease else None
	_attach_signed_copy(doc, doc.signee or tenant_name or doc.party_name)
	return {"status": frappe.db.get_value("Contract", doc.name, "status")}


@frappe.whitelist()
def download_document(kind: str, name: str) -> None:
	"""Stream a private lease file to someone allowed to see it, since the
	file's own permissions (tied to the Property/Contract it is attached to)
	don't cover tenants or Caretakers.

	kind: "property_lease" (a building's lease, its landlord's staff only),
	"contract_lease" / "contract_signed" (that staff, or the contract's own tenant).
	"""
	if kind == "property_lease":
		_require_staff()
		assert_owns("Property", name)
		file_url = frappe.db.get_value("Property", name, "lease_document")
	elif kind in ("contract_lease", "contract_signed"):
		if _is_staff():
			assert_owns("Contract", name)
		else:
			lease_name = frappe.db.get_value("Contract", name, "lease")
			if not lease_name or lease_name != _current_lease().name:
				frappe.throw(_("You are not permitted to view this document."), frappe.PermissionError)
		field = "lease_document" if kind == "contract_lease" else "signed_document"
		file_url = frappe.db.get_value("Contract", name, field)
	else:
		frappe.throw(_("Unknown document."))

	if not file_url:
		frappe.throw(_("No document has been uploaded yet."), frappe.DoesNotExistError)

	file = frappe.get_doc("File", {"file_url": file_url})
	frappe.local.response.filename = file.file_name
	frappe.local.response.filecontent = file.get_content()
	frappe.local.response.type = "download"


def _is_staff() -> bool:
	return bool({"Landlord", "Caretaker", "System Manager"} & set(frappe.get_roles()))


def _file_name(file_url: str | None) -> str | None:
	if not file_url:
		return None
	return frappe.db.get_value("File", {"file_url": file_url}, "file_name") or file_url.rsplit("/", 1)[-1]


STAFF_ROLES = ("Landlord", "Caretaker")


@frappe.whitelist()
def get_staff() -> list[dict]:
	"""The calling landlord and the Caretakers they added (every Landlord and
	Caretaker, for an administrator)."""
	_require_landlord()

	landlord = get_landlord()
	condition = "1=1"
	if landlord is not UNRESTRICTED:
		escaped = frappe.db.escape(landlord)
		condition = f"(user.name = {escaped} or user.kings_landlord = {escaped})"

	return frappe.db.sql(
		f"""
		select user.name, user.full_name, user.enabled, user.mobile_no,
		       group_concat(distinct has_role.role order by has_role.role) as roles
		from `tabUser` user
		join `tabHas Role` has_role on has_role.parent = user.name and has_role.parenttype = 'User'
		where has_role.role in %(roles)s and user.name not in ('Administrator', 'Guest')
		and {condition}
		group by user.name
		order by user.full_name
		""",
		{"roles": STAFF_ROLES},
		as_dict=True,
	)


@frappe.whitelist(methods=["POST"])
def create_staff_user(
	email: str,
	first_name: str,
	last_name: str | None = None,
	mobile_no: str | None = None,
	role: str = "Caretaker",
	password: str | None = None,
) -> dict:
	"""A Landlord adds a Caretaker, who then sees only that landlord's
	properties. Landlords sign up themselves (register_landlord), or an
	administrator adds one here. With a password the account is usable
	immediately; without one Frappe emails a set-your-password link (needs
	outgoing email configured)."""
	_require_landlord()
	if role not in STAFF_ROLES:
		frappe.throw(_("Invalid role."))
	landlord = get_landlord()
	if role == "Landlord" and landlord is not UNRESTRICTED:
		frappe.throw(_("Only an administrator can add a Landlord."), frappe.PermissionError)
	if frappe.db.exists("User", email):
		frappe.throw(_("An account with this email already exists."))

	user = frappe.new_doc("User")
	user.email = email
	user.first_name = first_name
	user.last_name = last_name
	user.mobile_no = mobile_no
	user.send_welcome_email = 0 if password else 1
	user.append("roles", {"role": role})
	if role == "Caretaker" and landlord is not UNRESTRICTED:
		user.kings_landlord = landlord
	if password:
		user.new_password = password
	user.flags.ignore_permissions = True
	user.insert()

	return {"name": user.name, "role": role}


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=5, seconds=60 * 60)
def register_landlord(
	first_name: str,
	email: str,
	password: str,
	last_name: str | None = None,
	mobile_no: str | None = None,
) -> dict:
	"""Public landlord sign-up: creates the account and signs them straight in.
	They start with no properties and only ever see the ones they register."""
	if frappe.session.user != "Guest":
		frappe.throw(_("You are already signed in."))
	email = (email or "").strip().lower()
	frappe.utils.validate_email_address(email, throw=True)
	if frappe.db.exists("User", email):
		frappe.throw(_("An account with this email already exists. Please sign in instead."))

	user = frappe.new_doc("User")
	user.email = email
	user.first_name = first_name
	user.last_name = last_name
	user.mobile_no = mobile_no
	user.send_welcome_email = 0
	user.append("roles", {"role": "Landlord"})
	user.new_password = password
	user.flags.ignore_permissions = True
	user.flags.no_welcome_mail = True
	user.insert()

	from frappe.auth import LoginManager

	if not getattr(frappe.local, "login_manager", None):
		frappe.local.login_manager = LoginManager()
	frappe.local.login_manager.login_as(user.name)

	return {"user": user.name}


def _current_lease() -> Document:
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in."), frappe.PermissionError)

	name = frappe.db.get_value(
		"Lease", {"tenant": frappe.session.user}, "name", order_by="creation desc"
	)
	if not name:
		frappe.throw(_("No lease is linked to this account."), frappe.PermissionError)

	return frappe.get_doc("Lease", name)


def _get_or_create_customer(full_name: str, phone: str, email: str) -> str:
	existing = frappe.db.get_value("Customer", {"email_id": email}, "name")
	if existing:
		return existing

	customer = frappe.new_doc("Customer")
	customer.customer_name = full_name
	customer.customer_type = "Individual"
	customer.customer_group = _get_default_customer_group()
	customer.territory = _get_default_territory()
	customer.mobile_no = phone
	customer.email_id = email
	customer.insert(ignore_permissions=True)
	return customer.name


def _get_default_customer_group() -> str | None:
	default = frappe.db.get_single_value("Selling Settings", "customer_group")
	if default and not frappe.db.get_value("Customer Group", default, "is_group"):
		return default
	return (
		frappe.db.get_value("Customer Group", {"name": "Individual", "is_group": 0}, "name")
		or frappe.db.get_value("Customer Group", {"is_group": 0}, "name")
	)


def _get_default_territory() -> str | None:
	default = frappe.db.get_single_value("Selling Settings", "territory")
	if default and not frappe.db.get_value("Territory", default, "is_group"):
		return default
	return (
		frappe.db.get_value("Territory", {"name": "Kenya", "is_group": 0}, "name")
		or frappe.db.get_value("Territory", {"is_group": 0}, "name")
	)
