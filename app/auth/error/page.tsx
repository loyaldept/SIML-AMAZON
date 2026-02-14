import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <img src="/favicon.png" alt="Siml" className="w-12 h-12 mx-auto mb-6 rounded-xl" />
        <h1 className="text-xl font-serif font-semibold text-stone-900 mb-2">Something went wrong</h1>
        {params?.error ? (
          <p className="text-sm text-stone-500 mb-6">Error: {params.error}</p>
        ) : (
          <p className="text-sm text-stone-500 mb-6">An unspecified error occurred during authentication.</p>
        )}
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  )
}
