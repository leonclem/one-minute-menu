export default function TestPage({ params }: { params: { userId: string; slug: string } }) {
  return (
    <div>
      <h1>Test Page Works!</h1>
      <p>User ID: {params.userId}</p>
      <p>Slug: {params.slug}</p>
    </div>
  )
}