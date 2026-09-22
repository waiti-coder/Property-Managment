# Copyright (c) 2026, Kings Solution and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import now_datetime

from kings_manage.kings_manage.doctype.portal_access_token.portal_access_token import notify

DEFAULT_CONTRACT_TEMPLATE = "Standard Residential Lease"


def on_lease_update(doc, method=None):
	if doc.status == "Submitted":
		_reserve_unit(doc)
		return

	if doc.status != "Active":
		return

	# Idempotency guard: never reprocess a lease that already has a Contract.
	if frappe.db.exists("Contract", {"lease": doc.name}):
		return

	if not doc.get("deposit_confirmed_on"):
		doc.db_set("deposit_confirmed_by", frappe.session.user, update_modified=False)
		doc.db_set("deposit_confirmed_on", now_datetime(), update_modified=False)

	create_contract(doc)
	_notify_approved(doc)
	create_deposit_invoice(doc)
	create_recurring_rent_invoice(doc)

	frappe.db.set_value("Unit", doc.unit, "status", "Occupied")


def _reserve_unit(doc):
	"""Once an application is Submitted, the unit should stop looking vacant
	to other applicants, even though nothing is approved or paid for yet."""
	if doc.unit and frappe.db.get_value("Unit", doc.unit, "status") == "Vacant":
		frappe.db.set_value("Unit", doc.unit, "status", "Reserved")


def create_contract(doc):
	template_name, terms = _get_default_contract_terms()

	contract = frappe.new_doc("Contract")
	contract.party_type = "Customer"
	contract.party_name = doc.customer
	contract.lease = doc.name
	contract.start_date = doc.start_date
	contract.end_date = doc.end_date
	contract.contract_template = template_name
	contract.contract_terms = terms
	contract.flags.ignore_permissions = True
	contract.flags.ignore_mandatory = True
	contract.insert()
	return contract.name


def create_deposit_invoice(doc):
	if not doc.deposit_amount:
		return
	_create_invoice(doc, invoice_type="Deposit", amount=doc.deposit_amount, enable_auto_repeat=False)


def create_recurring_rent_invoice(doc):
	if not doc.rent_amount:
		return
	_create_invoice(doc, invoice_type="Rent", amount=doc.rent_amount, enable_auto_repeat=True)


def _create_invoice(doc, invoice_type, amount, enable_auto_repeat):
	item_code = _get_or_create_item(invoice_type)

	invoice = frappe.new_doc("Sales Invoice")
	invoice.customer = doc.customer
	invoice.company = _get_default_company()
	invoice.lease = doc.name
	invoice.invoice_type = invoice_type
	invoice.append(
		"items",
		{
			"item_code": item_code,
			"item_name": invoice_type,
			"qty": 1,
			"rate": amount,
		},
	)
	invoice.flags.ignore_permissions = True
	invoice.insert()
	invoice.submit()

	if enable_auto_repeat:
		auto_repeat = frappe.new_doc("Auto Repeat")
		auto_repeat.reference_doctype = "Sales Invoice"
		auto_repeat.reference_document = invoice.name
		auto_repeat.frequency = "Monthly"
		auto_repeat.start_date = doc.start_date or frappe.utils.nowdate()
		if doc.end_date:
			auto_repeat.end_date = doc.end_date
		auto_repeat.flags.ignore_permissions = True
		auto_repeat.insert()

	return invoice.name


def _get_or_create_item(invoice_type):
	item_code = {"Rent": "Rent", "Water Bill": "Water Bill", "Deposit": "Deposit"}[invoice_type]
	if frappe.db.exists("Item", item_code):
		return item_code

	item = frappe.new_doc("Item")
	item.item_code = item_code
	item.item_name = item_code
	item.item_group = _get_default_item_group()
	item.stock_uom = "Nos"
	item.is_stock_item = 0
	item.flags.ignore_permissions = True
	item.insert()
	return item.name


def _get_default_item_group():
	return frappe.db.get_value("Item Group", {"is_group": 0}, "name") or "All Item Groups"


def _get_default_company() -> str | None:
	return frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")


def _get_default_contract_terms():
	"""The Contract doctype requires contract_terms; seed one reusable
	template so a lease can be created without staff writing lease
	language by hand first - they can always edit the wording later."""
	if frappe.db.exists("Contract Template", DEFAULT_CONTRACT_TEMPLATE):
		return DEFAULT_CONTRACT_TEMPLATE, frappe.db.get_value(
			"Contract Template", DEFAULT_CONTRACT_TEMPLATE, "contract_terms"
		)

	terms = (
		"This lease agreement automatically renews on a month-to-month basis after the "
		"initial term unless either party gives 30 days written notice. The tenant is "
		"responsible for rent and utilities as billed. The security deposit is refundable "
		"within 30 days of move-out, subject to deductions for damage beyond normal wear "
		"and tear."
	)
	template = frappe.new_doc("Contract Template")
	template.title = DEFAULT_CONTRACT_TEMPLATE
	template.contract_terms = terms
	template.flags.ignore_permissions = True
	template.insert()
	return template.name, terms


def _notify_approved(doc):
	token_name = frappe.db.get_value("Portal Access Token", {"lease": doc.name}, "name")
	if not token_name:
		return

	email = frappe.db.get_value("Customer", doc.customer, "email_id")
	if not email:
		return

	notify(
		frappe.get_doc("Portal Access Token", token_name),
		doc.tenant_name,
		email,
		"You're approved! Set up your account",
		"Good news - your application has been approved. Use the same link to set up "
		"your account, then download and sign your lease:",
	)
