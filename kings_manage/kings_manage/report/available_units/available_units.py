# Copyright (c) 2026, Kings Solution and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	columns = get_columns()
	data = get_data(filters or {})
	return columns, data


def get_columns():
	return [
		{"label": _("Unit"), "fieldname": "name", "fieldtype": "Link", "options": "Unit", "width": 150},
		{"label": _("Property"), "fieldname": "property", "fieldtype": "Link", "options": "Property", "width": 180},
		{"label": _("Floor"), "fieldname": "floor", "width": 100},
		{"label": _("Unit Number"), "fieldname": "unit_number", "width": 120},
		{"label": _("Unit Type"), "fieldname": "unit_type", "width": 150},
		{"label": _("Rent"), "fieldname": "rent_amount", "fieldtype": "Currency", "width": 120},
		{"label": _("Status"), "fieldname": "status", "width": 100},
	]


def get_data(filters):
	conditions = {"status": filters.get("status") or "Vacant"}
	if filters.get("property"):
		conditions["property"] = filters["property"]

	return frappe.get_all(
		"Unit",
		filters=conditions,
		fields=["name", "property", "floor", "unit_number", "unit_type", "rent_amount", "status"],
		order_by="property, floor, unit_number",
	)
