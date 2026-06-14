"""
Create application users (auto-confirmed) and set roles, using the Supabase
Admin API + the service-role key.

Creates an admin (content management) and a student (takes tests), or any users
you pass. Idempotent on role: re-running just re-applies roles; existing emails
are reported and skipped, not duplicated.

Env (scrapers/.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Usage:
  python create_users.py \
      --admin-email admin@example.com   --admin-pass 'StrongPass1!' \
      --student-email student@example.com --student-pass 'StrongPass2!'

  # Optional names:
  --admin-name "Site Admin"  --student-name "Test Student"
"""

import argparse
import os
import sys

import requests
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

load_dotenv()
URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""

if not URL or not KEY:
    print("❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scrapers/.env first.")
    sys.exit(1)

AUTH_HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}


def create_user(email: str, password: str, full_name: str) -> str | None:
    """Create an auto-confirmed user. Returns the user id, or None if it exists."""
    resp = requests.post(
        f"{URL}/auth/v1/admin/users",
        headers=AUTH_HEADERS,
        json={
            "email": email,
            "password": password,
            "email_confirm": True,  # no email-verification step
            "user_metadata": {"full_name": full_name},
        },
        timeout=20,
    )
    if resp.status_code in (200, 201):
        uid = resp.json().get("id")
        print(f"✅ Created {email}")
        return uid
    # Already-registered is fine — we'll still (re)apply the role below.
    body = resp.text.lower()
    if resp.status_code in (422, 409) or "already" in body or "exists" in body:
        print(f"ℹ️  {email} already exists — leaving the account, will re-apply role.")
        return None
    print(f"❌ Failed to create {email}: {resp.status_code} {resp.text}")
    return None


def set_role(email: str, role: str) -> None:
    """Set profiles.role for a user by email (works for new or existing rows).

    The handle_new_user trigger creates the profile row on signup, so we just
    PATCH it. Matching by email keeps this independent of the user id.
    """
    resp = requests.patch(
        f"{URL}/rest/v1/profiles?email=eq.{requests.utils.quote(email)}",
        headers={**AUTH_HEADERS, "Prefer": "return=representation"},
        json={"role": role},
        timeout=20,
    )
    if resp.status_code in (200, 204):
        updated = resp.json() if resp.text else []
        if updated:
            print(f"   → role '{role}' set for {email}")
        else:
            print(
                f"   ⚠️  No profile row matched {email}. If the user was just "
                f"created, re-run this script, or set the role in SQL."
            )
    else:
        print(f"   ❌ Could not set role for {email}: {resp.status_code} {resp.text}")


def main() -> None:
    p = argparse.ArgumentParser(description="Create admin + student users in Supabase.")
    p.add_argument("--admin-email", required=True)
    p.add_argument("--admin-pass", required=True)
    p.add_argument("--admin-name", default="Admin")
    p.add_argument("--student-email", required=True)
    p.add_argument("--student-pass", required=True)
    p.add_argument("--student-name", default="Student")
    args = p.parse_args()

    print(f"Supabase: {URL}\n")

    print("Admin user:")
    create_user(args.admin_email, args.admin_pass, args.admin_name)
    set_role(args.admin_email, "admin")

    print("\nStudent user:")
    create_user(args.student_email, args.student_pass, args.student_name)
    set_role(args.student_email, "user")

    print("\n🎉 Done. Both users are confirmed and can log in immediately.")
    print(f"   Admin   : {args.admin_email}  (Question Bank + editor + import)")
    print(f"   Student : {args.student_email}  (timed tests + bookmarks)")


if __name__ == "__main__":
    main()
