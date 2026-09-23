import frappe

PORTAL = "rental-portal"
PORTAL_ROLES = {"Tenant", "Landlord", "Caretaker"}


def get_home_page(user: str) -> str | None:
	"""Landing page for "/" and for the redirect right after login.

	Guests and anyone holding a Kings Manage role land on the portal; the
	Administrator keeps the desk so the ERPNext backend stays one click away.
	Returning None leaves every other user on Frappe's usual default.
	"""
	if user == "Guest":
		return PORTAL
	if user == "Administrator":
		return "desk"
	if PORTAL_ROLES & set(frappe.get_roles(user)):
		return PORTAL
	return None
