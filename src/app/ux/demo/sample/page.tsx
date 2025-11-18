import dynamic from 'next/dynamic'

const DemoSampleClient = dynamic(() => import('./demo-sample-client'), {
  ssr: false,
})

export default function UXDemoSamplePage() {
  return <DemoSampleClient />
}