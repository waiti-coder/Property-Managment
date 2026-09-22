// Copyright (c) 2026, Kings Solution and contributors
// For license information, please see license.txt

frappe.query_reports["Available Units"] = {
	filters: [
		{
			fieldname: "property",
			label: __("Property"),
			fieldtype: "Link",
			options: "Property",
		},
		{
			fieldname: "status",
			label: __("Status"),
			fieldtype: "Select",
			options: "Vacant\nReserved\nOccupied\nUnder Maintenance",
			default: "Vacant",
			reqd: 1,
		},
	],
};
