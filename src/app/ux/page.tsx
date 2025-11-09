import { UXButton } from '@/components/ux'
import Link from 'next/link'

export default function UXHomePage() {
  return (
    <div className="w-full h-full">
      <section className="relative w-full h-full">
        <div className="relative container-ux mx-auto max-w-4xl px-6 py-6 md:py-8 space-y-4 md:space-y-5 grid place-items-center text-center">
          <div className="max-h-[55vh]">
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
              Ready to create your new beautiful menu in under 5 minutes?
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto text-hero-shadow mt-3">
              Transform your menu into a print- and mobile-friendly, flexible digital menu. Instant price changes, 86'ing and much more.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-4">
              <Link href="/ux/register" className="w-full sm:w-auto">
                <UXButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[240px]">
                  ✨ Transform My Menu
                </UXButton>
              </Link>
              <Link href="/ux/demo/sample" className="w-full sm:w-auto">
                <UXButton variant="warning" size="lg" className="w-full sm:w-auto min-w-[240px]">
                  Try a Demo Menu
                </UXButton>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}