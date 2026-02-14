import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <img src="/favicon.png" alt="Siml" className="h-16 w-16 rounded-xl mb-4 mx-auto" />
        <h1 className="text-2xl font-serif text-stone-900 mb-2">Check your email</h1>
        <p className="text-sm text-stone-500 mb-6">
          {"We've sent a confirmation link to your email. Click it to activate your account."}
        </p>
        <Link href="/auth/login" className="inline-block px-6 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors">
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
