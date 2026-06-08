import React, { useEffect } from 'react'
import { gaViewPricing } from '../lib/analytics.js'
export default function Pricing() {
  useEffect(() => {
    gaViewPricing('marketing_pricing_page')
  }, [])

  return <div className="container mx-auto p-4"><h1 className="text-2xl font-bold mb-4">Pricing</h1><p>Информация о тарифах появится здесь.</p></div>
}