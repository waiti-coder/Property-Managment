# Kings Manage

Property management SaaS for the Kenyan market — helping landlords manage their apartments and giving them full visibility into vacancies, applications, rent, deposits, and maintenance, all in one place.

Kings Manage is a fully independent [Frappe](https://frappeframework.com/) app that installs directly on top of [ERPNext](https://erpnext.com/) — no other custom app required. It reuses ERPNext's own Sales Invoice, Payment Entry, Customer, and Contract doctypes wherever they fit, adding only the property-management-specific concepts (`Property`, `Unit`, `Lease`) on top.

## What it does

- **Property & unit registration** — Landlords register buildings/estates and their units (with floor/house numbers) entirely through the portal, no ERPNext desk access required.
- **Public tenant applications** — Prospective tenants browse vacant units and submit an interest/application form without an account.
- **KYC & deposit workflow** — Applications move through a Lease workflow (Submitted → KYC Verification → Awaiting Deposit → Active), with manual deposit confirmation (attach a payment reference/proof — no M-Pesa integration required).
- **Tenant registration & e-signing** — Once approved, tenants get a registration link, can e-sign their contract, or attach a scanned, physically-signed copy.
- **Rent & dues** — Rent and water invoices are created automatically on approval (recurring via Auto Repeat) and tenants can see what they owe and download receipts.
- **Issue reporting** — Tenants report maintenance issues with photos; caretakers resolve them with resolution notes/photos.
- **Notice to vacate** — Tenants can give notice; landlords/caretakers see a live count and list of notices on their dashboard.
- **Role-based access** — Landlord (sees everything), Caretaker (manages units/issues), and Tenant (portal-only, no desk access) are proper Frappe roles with real doctype permissions.

## Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI. It only requires an existing bench with ERPNext already set up — `erpnext` is declared as a required app, so `bench install-app` pulls it in automatically if it isn't already installed on the site:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/waiti-coder/Property-Managment.git --branch develop
bench install-app kings_manage
```

## Frontend

The tenant/landlord portal is a React + Vite single-page app in [`frontend/`](./frontend). To build it:

```bash
cd apps/kings_manage/frontend
yarn install
yarn build
```

This outputs the built assets into `kings_manage/public/rental-portal` and regenerates `kings_manage/www/rental-portal.html`, so the portal is served by the site at `/rental-portal`. For local development, `yarn dev` starts a Vite dev server (proxying API calls to your local bench site).

## Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/kings_manage
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

## License

mit
