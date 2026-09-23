# Copyright (c) 2026, Kings Solution and contributors
# For license information, please see license.txt

"""Per-landlord data isolation.

Every Kings Manage record hangs off a Property, and Property.landlord says who
owns it. A Landlord sees only rows under their own properties; a Caretaker
sees their landlord's (User.kings_landlord, set when the landlord adds them).
Administrator / System Manager see everything, and users without either
role are left to their ordinary role permissions.

The same rules serve both the desk (permission_query_conditions and
has_permission hooks) and the portal endpoints, which query with
ignore_permissions and so must filter explicitly via property_condition().
"""

import frappe

UNRESTRICTED = None
# A caretaker nobody has assigned to a landlord owns nothing.
NOBODY = "__no_landlord__"


def get_landlord(user: str | None = None) -> str | None:
	"""The landlord whose data `user` may see, or None when unrestricted."""
	user = user or frappe.session.user
	if user == "Administrator":
		return UNRESTRICTED

	roles = frappe.get_roles(user)
	if "System Manager" in roles:
		return UNRESTRICTED
	if "Landlord" in roles:
		return user
	if "Caretaker" in roles:
		return frappe.db.get_value("User", user, "kings_landlord") or NOBODY
	return UNRESTRICTED


def property_condition(column: str, user: str | None = None) -> str:
	"""SQL condition restricting a Property-name `column` to the caller's
	properties ("1=1" when unrestricted)."""
	landlord = get_landlord(user)
	if landlord is UNRESTRICTED:
		return "1=1"
	return f"{column} in (select name from `tabProperty` where landlord = {frappe.db.escape(landlord)})"


def _unit_names(landlord: str) -> str:
	return (
		"select unit.name from `tabUnit` unit join `tabProperty` prop on prop.name = unit.property "
		f"where prop.landlord = {frappe.db.escape(landlord)}"
	)


def _lease_names(landlord: str) -> str:
	return f"select name from `tabLease` where unit in ({_unit_names(landlord)})"


def _conditions(doctype: str, landlord: str) -> str:
	escaped = frappe.db.escape(landlord)
	table = f"`tab{doctype}`"
	return {
		"Property": f"{table}.landlord = {escaped}",
		"Unit": f"{table}.name in ({_unit_names(landlord)})",
		"Lease": f"{table}.name in ({_lease_names(landlord)})",
		"Contract": f"{table}.lease in ({_lease_names(landlord)})",
		"Sales Invoice": f"{table}.lease in ({_lease_names(landlord)})",
		"Issue": f"{table}.unit in ({_unit_names(landlord)})",
		"Payment Entry": (
			f"{table}.name in (select parent from `tabPayment Entry Reference` "
			"where reference_doctype = 'Sales Invoice' and reference_name in "
			f"(select name from `tabSales Invoice` where lease in ({_lease_names(landlord)})))"
		),
	}[doctype]


SCOPED_DOCTYPES = ("Property", "Unit", "Lease", "Contract", "Sales Invoice", "Issue", "Payment Entry")


def get_permission_query_conditions(user: str | None = None, doctype: str | None = None) -> str:
	landlord = get_landlord(user)
	if landlord is UNRESTRICTED or doctype not in SCOPED_DOCTYPES:
		return ""
	return _conditions(doctype, landlord)


def has_permission(doc, ptype: str | None = None, user: str | None = None) -> bool | None:
	landlord = get_landlord(user)
	if landlord is UNRESTRICTED or doc.doctype not in SCOPED_DOCTYPES:
		return None
	return owns(doc, landlord)


def owns(doc, landlord: str) -> bool:
	"""Whether `doc` (saved or not) sits under one of `landlord`'s properties."""
	if doc.doctype == "Property":
		# A property being created is claimed by its creator (see set_property_landlord).
		return (doc.is_new() and not doc.landlord) or doc.landlord == landlord

	property_name = _property_of(doc)
	if not property_name:
		# Not attached to any property yet: only new records may pass, and
		# they're claimed once linked.
		return doc.is_new()
	return frappe.db.get_value("Property", property_name, "landlord") == landlord


def _property_of(doc) -> str | None:
	if doc.doctype == "Unit":
		return doc.property
	unit = None
	if doc.doctype in ("Lease", "Issue"):
		unit = doc.get("unit")
	elif doc.doctype in ("Contract", "Sales Invoice"):
		unit = frappe.db.get_value("Lease", doc.get("lease"), "unit") if doc.get("lease") else None
	elif doc.doctype == "Payment Entry":
		invoices = [
			r.reference_name for r in doc.get("references") or [] if r.reference_doctype == "Sales Invoice"
		]
		leases = frappe.get_all(
			"Sales Invoice", {"name": ["in", invoices]}, pluck="lease", ignore_permissions=True
		)
		units = {frappe.db.get_value("Lease", lease, "unit") for lease in leases if lease}
		properties = {frappe.db.get_value("Unit", u, "property") for u in units if u}
		# A payment spanning several landlords' invoices belongs to none of them.
		return properties.pop() if len(properties) == 1 else None
	return frappe.db.get_value("Unit", unit, "property") if unit else None


def set_property_landlord(doc, method=None):
	"""A Landlord (or their Caretaker) creating a property owns it."""
	if doc.landlord:
		landlord = get_landlord()
		if landlord not in (UNRESTRICTED, doc.landlord):
			frappe.throw(frappe._("You can only register properties for your own account."))
		return
	landlord = get_landlord()
	if landlord not in (UNRESTRICTED, NOBODY):
		doc.landlord = landlord


def assert_owns(doctype: str, name: str) -> None:
	"""Portal-endpoint guard: 404 rather than leak another landlord's record."""
	landlord = get_landlord()
	if landlord is UNRESTRICTED:
		return
	if not frappe.db.exists(doctype, name) or not owns(frappe.get_doc(doctype, name), landlord):
		frappe.throw(frappe._("{0} {1} not found").format(frappe._(doctype), name), frappe.DoesNotExistError)
