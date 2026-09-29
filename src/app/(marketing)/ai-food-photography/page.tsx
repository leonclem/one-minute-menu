import AiFoodPhotographyContent from './AiFoodPhotographyContent'
import { getAiFoodPhotographyMetadata } from './metadata'

export const metadata = getAiFoodPhotographyMetadata()

export default function AiFoodPhotographyPage() {
  return <AiFoodPhotographyContent />
}
