# Copyright (c) 2026, Kings Solution and contributors
# For license information, please see license.txt

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

ROLES = ["Landlord", "Caretaker", "Tenant"]

WORKFLOW_STATES = [
	"Draft",
	"Submitted",
	"KYC Verification",
	"Awaiting Deposit",
	"Active",
	"Rejected",
	"Ended",
]
WORKFLOW_ACTIONS = ["Submit", "Review", "Approve", "Confirm Deposit", "Reject", "End Lease"]

WORKFLOW_NAME = "Lease Application Workflow"

ISSUE_CATEGORY_OPTIONS = "Plumbing\nElectrical\nStructural\nOther"
ISSUE_PRIORITIES = ["Low", "Medium", "High"]

CUSTOM_FIELDS = {
	"Sales Invoice": [
		{
			"fieldname": "lease",
			"fieldtype": "Link",
			"options": "Lease",
			"label": "Lease",
			"insert_after": "customer",
		},
		{
			"fieldname": "invoice_type",
			"fieldtype": "Select",
			"options": "Rent\nWater Bill\nDeposit",
			"label": "Invoice Type",
			"insert_after": "lease",
			"in_list_view": 1,
			"in_standard_filter": 1,
		},
	],
	"Contract": [
		{
			"fieldname": "lease",
			"fieldtype": "Link",
			"options": "Lease",
			"label": "Lease",
			"insert_after": "document_name",
			"read_only": 1,
		},
		{
			"fieldname": "signed_document",
			"fieldtype": "Attach",
			"label": "Signed Document",
			"description": "A scanned/photographed copy of the physically signed lease, "
			"attached by the tenant.",
			"insert_after": "signed_on",
		},
	],
	"Issue": [
		{
			"fieldname": "unit",
			"fieldtype": "Link",
			"options": "Unit",
			"label": "Unit",
			"insert_after": "customer",
		},
		{
			"fieldname": "category",
			"fieldtype": "Select",
			"options": ISSUE_CATEGORY_OPTIONS,
			"label": "Category",
			"insert_after": "unit",
		},
		{
			"fieldname": "photo",
			"fieldtype": "Attach Image",
			"label": "Photo",
			"description": "Photo attached by the tenant when the issue was reported.",
			"insert_after": "category",
		},
		{
			"fieldname": "resolution_photo",
			"fieldtype": "Attach Image",
			"label": "Resolution Photo",
			"description": "Photo attached by the caretaker as proof the issue was fixed.",
			"insert_after": "resolution_details",
		},
	],
}


def after_install():
	ensure_defaults()


def after_migrate():
	ensure_defaults()


def ensure_defaults():
	create_roles()
	disable_desk_access_for_customer_role()
	create_workflow_states_and_actions()
	create_custom_fields(CUSTOM_FIELDS, ignore_validate=True)
	grant_core_doctype_permissions()
	create_lease_workflow()
	enable_auto_repeat_on_sales_invoice()
	ensure_issue_priorities()
	make_portal_the_default_app()


def make_portal_the_default_app():
	"""Website Users (tenants) are redirected after login to the site's
	default app before any home-page hook is consulted, and with ERPNext
	installed that default is /desk/home, which tenants can't use. Pointing
	it at Kings Manage (route /rental-portal, see add_to_apps_screen) lands
	them on the portal. Only set it when nobody has chosen another default."""
	if not frappe.db.get_single_value("System Settings", "default_app"):
		frappe.db.set_single_value("System Settings", "default_app", "kings_manage")


def disable_desk_access_for_customer_role():
	"""ERPNext's own "Customer" role ships with desk_access=1, and
	erpnext.portal.utils.set_default_role re-grants that role to any User
	whose email matches a Contact linked to a Customer - which is every
	tenant here, since a Customer is auto-created for each of them. Frappe
	forces User.user_type back to "System User" the moment *any* assigned
	role has desk_access, so left alone this silently hands every tenant
	desk/admin access. Tenants must be portal-only."""
	if frappe.db.get_value("Role", "Customer", "desk_access"):
		frappe.db.set_value("Role", "Customer", "desk_access", 0)


def ensure_issue_priorities():
	"""Core ERPNext Issue.priority links to Issue Priority - seed the three
	values the app expects so it isn't blank out of the box."""
	for name in ISSUE_PRIORITIES:
		if not frappe.db.exists("Issue Priority", name):
			frappe.get_doc({"doctype": "Issue Priority", "name": name}).insert(
				ignore_permissions=True
			)


def enable_auto_repeat_on_sales_invoice():
	"""Frappe's Auto Repeat feature refuses to attach to a doctype unless
	"Allow Auto Repeat" is switched on for it. The recurring-rent Sales
	Invoice flow depends on this being enabled, but ERPNext ships no fixture
	for it, so we set it as a Property Setter (Customize Form's own mechanism)."""
	if frappe.db.exists(
		"Property Setter", {"doc_type": "Sales Invoice", "property": "allow_auto_repeat"}
	):
		return

	frappe.make_property_setter(
		{
			"doctype": "Sales Invoice",
			"doctype_or_field": "DocType",
			"property": "allow_auto_repeat",
			"value": 1,
			"property_type": "Check",
		}
	)


def create_roles():
	# Tenant is portal-only - it must NEVER carry desk access. Frappe forces
	# User.user_type to "System User" the moment any assigned role has
	# desk_access=1, which would silently hand a tenant desk/admin access.
	desk_access = {"Landlord": 1, "Caretaker": 1, "Tenant": 0}

	for role in ROLES:
		if not frappe.db.exists("Role", role):
			frappe.get_doc(
				{"doctype": "Role", "role_name": role, "desk_access": desk_access[role]}
			).insert(ignore_permissions=True)
		else:
			frappe.db.set_value("Role", role, "desk_access", desk_access[role])


def create_workflow_states_and_actions():
	for state in WORKFLOW_STATES:
		if not frappe.db.exists("Workflow State", state):
			frappe.get_doc({"doctype": "Workflow State", "workflow_state_name": state}).insert(
				ignore_permissions=True
			)

	for action in WORKFLOW_ACTIONS:
		if not frappe.db.exists("Workflow Action Master", action):
			frappe.get_doc({"doctype": "Workflow Action Master", "workflow_action_name": action}).insert(
				ignore_permissions=True
			)


def grant_core_doctype_permissions():
	"""Give Landlord/Caretaker access to the ERPNext core doctypes this app
	reuses (Contract, Sales Invoice, Payment Entry, Issue), without touching
	those doctypes' own shipped DocType permissions (Custom DocPerm only)."""
	rows = [
		("Contract", "Landlord", {"read": 1, "write": 1, "create": 1, "report": 1, "print": 1, "email": 1}),
		("Sales Invoice", "Landlord", {"read": 1, "report": 1, "print": 1}),
		("Payment Entry", "Landlord", {"read": 1, "report": 1, "print": 1}),
		("Issue", "Landlord", {"read": 1, "write": 1, "report": 1, "print": 1, "email": 1}),
		("Issue", "Caretaker", {"read": 1, "write": 1, "report": 1}),
	]

	for doctype, role, perms in rows:
		if frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role}):
			continue
		frappe.get_doc(
			{
				"doctype": "Custom DocPerm",
				"parent": doctype,
				"parenttype": "DocType",
				"parentfield": "permissions",
				"role": role,
				**perms,
			}
		).insert(ignore_permissions=True)


def create_lease_workflow():
	definition = {
		"states": [
			{"state": "Draft", "doc_status": "0", "allow_edit": "Landlord"},
			{"state": "Submitted", "doc_status": "0", "allow_edit": "Landlord"},
			{"state": "KYC Verification", "doc_status": "0", "allow_edit": "Landlord"},
			{"state": "Awaiting Deposit", "doc_status": "0", "allow_edit": "Landlord"},
			{"state": "Active", "doc_status": "0", "allow_edit": "Landlord"},
			{"state": "Rejected", "doc_status": "0", "allow_edit": "Landlord"},
			{"state": "Ended", "doc_status": "0", "allow_edit": "Landlord"},
		],
		"transitions": [
			{
				"state": "Draft",
				"action": "Submit",
				"next_state": "Submitted",
				"allowed": "System Manager",
			},
			{
				"state": "Submitted",
				"action": "Review",
				"next_state": "KYC Verification",
				"allowed": "Landlord",
			},
			{
				"state": "Submitted",
				"action": "Review",
				"next_state": "KYC Verification",
				"allowed": "Caretaker",
			},
			{
				"state": "KYC Verification",
				"action": "Approve",
				"next_state": "Awaiting Deposit",
				"allowed": "Landlord",
			},
			{
				"state": "KYC Verification",
				"action": "Approve",
				"next_state": "Awaiting Deposit",
				"allowed": "Caretaker",
			},
			{
				"state": "KYC Verification",
				"action": "Reject",
				"next_state": "Rejected",
				"allowed": "Landlord",
				"condition": "doc.rejection_reason",
			},
			{
				"state": "KYC Verification",
				"action": "Reject",
				"next_state": "Rejected",
				"allowed": "Caretaker",
				"condition": "doc.rejection_reason",
			},
			{
				"state": "Awaiting Deposit",
				"action": "Confirm Deposit",
				"next_state": "Active",
				"allowed": "Landlord",
				"condition": "doc.deposit_reference or doc.deposit_proof",
			},
			{
				"state": "Awaiting Deposit",
				"action": "Confirm Deposit",
				"next_state": "Active",
				"allowed": "Caretaker",
				"condition": "doc.deposit_reference or doc.deposit_proof",
			},
			{
				"state": "Awaiting Deposit",
				"action": "Reject",
				"next_state": "Rejected",
				"allowed": "Landlord",
				"condition": "doc.rejection_reason",
			},
			{
				"state": "Active",
				"action": "End Lease",
				"next_state": "Ended",
				"allowed": "Landlord",
			},
		],
	}

	existing = frappe.db.get_value("Workflow", WORKFLOW_NAME, "name")
	if existing:
		workflow = frappe.get_doc("Workflow", existing)
		workflow.set("states", [])
		workflow.set("transitions", [])
		for state in definition["states"]:
			workflow.append("states", state)
		for transition in definition["transitions"]:
			workflow.append("transitions", transition)
		workflow.save(ignore_permissions=True)
		return

	workflow = frappe.get_doc(
		{
			"doctype": "Workflow",
			"workflow_name": WORKFLOW_NAME,
			"document_type": "Lease",
			"workflow_state_field": "status",
			"is_active": 1,
			"override_status": 0,
			"send_email_alert": 0,
			**definition,
		}
	)
	workflow.insert(ignore_permissions=True)
