import Link from "next/link";

/** Shown while an account is still using a temporary password issued by an administrator. */
export function PasswordBanner({ href }: { href: string }) {
  return (
    <div role="alert" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <span className="font-semibold">Please choose your own password.</span> You are using a temporary password set by your administrator.{" "}
      <Link href={href} className="font-semibold underline">Change password now</Link>
    </div>
  );
}
