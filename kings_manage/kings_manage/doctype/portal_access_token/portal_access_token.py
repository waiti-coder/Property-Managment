# Copyright (c) 2026, Kings Solution and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_days, now_datetime


TOKEN_VALIDITY_DAYS = 30


class PortalAccessToken(Document):
	pass


def issue_token(lease: str) -> "PortalAccessToken":
	"""Create (or reuse) the single tracking token for an applicant's journey."""
	existing = frappe.db.get_value(
		"Portal Access Token", {"lease": lease, "status": "Active"}, "name"
	)
	if existing:
		return frappe.get_doc("Portal Access Token", existing)

	doc = frappe.new_doc("Portal Access Token")
	doc.token = frappe.generate_hash(length=48)
	doc.lease = lease
	doc.expires_on = add_days(now_datetime(), TOKEN_VALIDITY_DAYS)
	doc.insert(ignore_permissions=True)
	return doc


def notify(token_doc: "PortalAccessToken", full_name: str, email: str, subject: str, body: str) -> None:
	"""Email the applicant their tracking link. Delivery failures (e.g. no
	outgoing Email Account configured yet) must never break the caller's
	transaction, so we log and swallow instead of raising. Queued (not
	sent now=True) so a slow/unreachable SMTP server can't hang the
	request that triggered this - e.g. a Landlord approving a lease."""
	base_url = frappe.utils.get_url()
	link = f"{base_url}/rental-portal/apply/status?token={token_doc.token}"
	try:
		frappe.sendmail(
			recipients=[email],
			subject=subject,
			message=f"<p>Hi {frappe.utils.escape_html(full_name)},</p><p>{body}</p><p><a href=\"{link}\">{link}</a></p>",
		)
	except Exception:
		frappe.log_error(title="Portal Access Token notification failed", message=frappe.get_traceback())


def get_active_token(token: str) -> "PortalAccessToken":
	"""Fetch a live Portal Access Token or raise a friendly error."""
	name = frappe.db.get_value("Portal Access Token", {"token": token}, "name")
	if not name:
		frappe.throw("This link is invalid.", frappe.DoesNotExistError)

	doc = frappe.get_doc("Portal Access Token", name)
	if doc.status == "Used":
		frappe.throw("This link has already been used.")
	if doc.status == "Expired" or (doc.expires_on and now_datetime() > doc.expires_on):
		if doc.status != "Expired":
			doc.db_set("status", "Expired")
		frappe.throw("This link has expired. Please contact us for a new one.")

	return doc
