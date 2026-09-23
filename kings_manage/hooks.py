app_name = "kings_manage"
app_title = "Kings Manage"
app_publisher = "Kings Solution"
app_description = "Independent property management SaaS for the Kenyan market, built on ERPNext"
app_email = "edwin@upande.com"
app_license = "mit"

# Send non-GET requests for this app's endpoints as native `application/json`
# bodies instead of form-encoded, per-key JSON-stringified values.
use_json_request_body = True

# Apps
# ------------------

required_apps = ["erpnext"]

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "kings_manage",
		"logo": "/assets/kings_manage/rental-portal/favicon.svg",
		"title": "Kings Manage",
		"route": "/rental-portal",
	}
]

# The dock, the rail down the left of the desk, is a document rather than a hook. Author it in
# Manage Dock on a developer-mode site and press Export to App, and it is written to
# `kings_manage/dock/kings_manage/kings_manage.json` for git to carry. An app that ships none has no
# rail: its sidebar gets a switcher in the header instead.
#
# A companion app, one that extends a host app rather than standing on its own, says so with
# `mount_on` on that same record, and its entries are appended to the host's rail. Mounting keeps
# the companion off the apps screen, so it takes precedence over any add_to_apps_screen above.

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/kings_manage/css/kings_manage.css"
# app_include_js = "/assets/kings_manage/js/kings_manage.js"

# include js, css files in header of web template
# web_include_css = "/assets/kings_manage/css/kings_manage.css"
# web_include_js = "/assets/kings_manage/js/kings_manage.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "kings_manage/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "kings_manage/public/icons.svg"

# Website Route Rules
# -------------------

# The portal is a client-side-routed SPA: serve www/rental-portal.html for every
# sub-path so deep links and page refreshes don't 404.
website_route_rules = [
	{"from_route": "/rental-portal/<path:app_path>", "to_route": "rental-portal"},
]

# Entering the site at "/" opens the portal's sign-in page; the portal itself
# forwards already signed-in users on to their dashboard. 302 so browsers
# don't cache it permanently.
website_redirects = [
	{"source": "/", "target": "/rental-portal/auth/sign-in", "redirect_http_status": 302},
]

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Send visitors and Kings Manage users to the portal, both on "/" and after login.
get_website_user_home_page = "kings_manage.kings_manage.home.get_home_page"

# Setup Wizard
# ------------

# open a fresh site's setup in this app's own UI instead of the desk wizard.
# must be a non-desk route (not under /desk or /app); to customize setup within
# desk, use setup_wizard_stages / setup_wizard_complete instead.
# setup_wizard_url = "/kings_manage/setup"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "kings_manage.utils.jinja_methods",
# 	"filters": "kings_manage.utils.jinja_filters"
# }

# Installation
# ------------

after_install = "kings_manage.kings_manage.setup.install.after_install"
after_migrate = "kings_manage.kings_manage.setup.install.after_migrate"

# Uninstallation
# ------------

# before_uninstall = "kings_manage.uninstall.before_uninstall"
# after_uninstall = "kings_manage.uninstall.after_uninstall"

# Disable / Enable
# ----------------
# Called when this app is logically disabled or re-enabled on a site,
# without uninstalling it. Use this to hide/restore fields this app adds
# to other apps' doctypes.

# before_disable = "kings_manage.uninstall.before_disable"
# after_disable = "kings_manage.uninstall.after_disable"
# before_enable = "kings_manage.install.before_enable"
# after_enable = "kings_manage.install.after_enable"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "kings_manage.utils.before_app_install"
# after_app_install = "kings_manage.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "kings_manage.utils.before_app_uninstall"
# after_app_uninstall = "kings_manage.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "kings_manage.build.after_build"

# To hook into the build process of other apps
# The list of apps being built is passed as an argument

# after_app_build = "kings_manage.build.after_app_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "kings_manage.notifications.get_notification_config"

# Awesome Bar
# -----------
# Extra search results: list of dicts with label, description, route, index.
# route: ["List", "ToDo"], "/desk/docs/some/page", or "https://example.com"
# awesomebar_search = ["kings_manage.search.awesomebar_results"]

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Lease": {
		"on_update": "kings_manage.kings_manage.lease.on_lease_update",
	},
	"Property": {
		"validate": "kings_manage.kings_manage.scope.set_property_landlord",
	},
}

# Each landlord sees only records under their own properties, in the desk
# too - see kings_manage/kings_manage/scope.py.
_SCOPED = ("Property", "Unit", "Lease", "Contract", "Sales Invoice", "Issue", "Payment Entry")
permission_query_conditions = {
	doctype: "kings_manage.kings_manage.scope.get_permission_query_conditions" for doctype in _SCOPED
}
has_permission = {doctype: "kings_manage.kings_manage.scope.has_permission" for doctype in _SCOPED}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"kings_manage.tasks.all"
# 	],
# 	"daily": [
# 		"kings_manage.tasks.daily"
# 	],
# 	"hourly": [
# 		"kings_manage.tasks.hourly"
# 	],
# 	"weekly": [
# 		"kings_manage.tasks.weekly"
# 	],
# 	"monthly": [
# 		"kings_manage.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "kings_manage.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "kings_manage.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "kings_manage.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "kings_manage.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["kings_manage.utils.before_request"]
# after_request = ["kings_manage.utils.after_request"]

# Job Events
# ----------
# before_job = ["kings_manage.utils.before_job"]
# after_job = ["kings_manage.utils.after_job"]

# after_file_upload = ["kings_manage.utils.after_file_upload"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"kings_manage.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
export_python_type_annotations = True

# Require all whitelisted methods to have type annotations
require_type_annotated_api_methods = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

