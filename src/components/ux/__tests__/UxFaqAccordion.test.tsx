import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { UxFaqAccordion } from '@/components/ux/UxFaqAccordion'

describe('UxFaqAccordion', () => {
  const faqs = [
    { question: 'Do I need to write prompts?', answer: 'No.' },
    { question: 'How do credits work?', answer: 'New accounts start with 10 free credits.' },
  ]

  it('renders questions and reveals an answer when opened', async () => {
    const user = userEvent.setup()
    render(<UxFaqAccordion faqs={faqs} />)

    expect(screen.getByText('Do I need to write prompts?')).toBeInTheDocument()
    const credits = screen.getByText('How do credits work?')
    await user.click(credits)
    expect(screen.getByText(/new accounts start with 10 free credits/i)).toBeVisible()
  })

  it('uses divided rows for the support-page variant', () => {
    const { container } = render(<UxFaqAccordion faqs={faqs} variant="divided" />)
    expect(container.querySelector('.ux-faq-divided')).not.toBeNull()
    expect(container.querySelector('.ux-faq-row')).not.toBeNull()
  })
})
