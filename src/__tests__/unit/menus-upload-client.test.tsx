import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import UploadClient from '../../app/menus/[menuId]/upload/UploadClient'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe('UploadClient', () => {
  it('renders manual entry link with correct href', () => {
    render(<UploadClient menuId="abc123" />)
    const link = screen.getByRole('link', { name: /enter items manually/i }) as HTMLAnchorElement
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/menus/abc123/extracted?manual=true')
  })
})


