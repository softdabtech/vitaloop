import { useNavigate } from 'react-router-dom'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'

function getLegalPagePadding() {
  if (typeof window === 'undefined') return '80px 24px'
  return window.innerWidth < 500 ? '40px 16px' : '80px 24px'
}

export default function UaTerms() {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--white, #ffffff)',
      color: 'var(--gray-900, #1d1d1f)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Premium Display", sans-serif',
      padding: getLegalPagePadding(),
      maxWidth: 720,
      margin: '0 auto',
    }}>
      <Seo
        title="Умови використання | VITALOOP Ukraine"
        description="Ознайомтеся з умовами використання VITALOOP, умовами підписки, медичним дисклеймером та відповідальністю."
        path="/terms"
      />
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 14, color: 'var(--teal-600, #0F6E56)',
          marginBottom: 48, padding: 0,
        }}
      >
        ← Назад до VITALOOP
      </button>
      <h1 style={{ fontSize: 34, lineHeight: 1.2, fontWeight: 700, color: 'var(--gray-900, #1d1d1f)', marginBottom: 12 }}>Умови використання</h1>
      <p style={{ color: 'var(--gray-500, #6e6e73)', fontSize: 14, marginBottom: 32 }}>Останнє оновлення: квітень 2026</p>

      <section style={{ display: 'grid', gap: 24, fontSize: 15, lineHeight: 1.7, color: 'var(--gray-700, #424245)' }}>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>1. Прийняття умов</h2>
          <p>Використовуючи VITALOOP, ви погоджуєтесь із цими умовами. Якщо ви не згодні, будь ласка, не використовуйте сервіс.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>2. Медичний дисклеймер та обмеження штучного інтелекту</h2>
          <p><strong style={{ color: '#c62828' }}>VITALOOP не є медичним устаткуванням, медичною організацією або постачальником медичних послуг.</strong> Аналіз та протоколи, створені нашим штучним інтелектом, призначені <strong>тільки для інформаційних та освітніх цілей</strong> і не становлять медичну пораду, діагноз, лікування або рецепт.</p>
          <p><strong>AI-генерований контент:</strong> Наш аналіз використовує штучний інтелект (Anthropic та OpenAI) для обробки ваших лабораторних даних. Результати AI можуть бути неповними, неточними або відображати обмеження моделей штучного інтелекту. Ви несете відповідальність за підтвердження будь-яких клінічних рішень у кваліфікованого ліцензованого медичного працівника.</p>
          <p><strong>Відсутність екстреної допомоги:</strong> VITALOOP не призначений для екстрених ситуацій. Якщо у вас медичне питання, безпосередня небезпека або думки про самоушкодження, негайно зверніться до місцевої служби екстреної допомоги або кризової лінії. Не покладайтеся на VITALOOP для екстрених ситуацій.</p>
          <p>Завжди проконсультуйтеся з ліцензованим лікарем перед тим, як приймати будь-які рішення щодо здоров'я або медицини.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>3. Підписка</h2>
          <p>Доступ до повних функцій Premium може потребувати активної підписки або ручного схвалення доступу за {PREMIUM_PRICE_LABEL}. VITALOOP не відправляє симптоми, завантажені лабораторні файли, значення біомаркерів або звіти про здоров'я до інструментів виставлення рахунків.</p>
          <p>Підписки можна скасувати з облікового запису в розділі виставлення рахунків або зв'язавшись з <a href="mailto:info@softdab.tech" style={{ color: 'var(--teal-500)' }}>info@softdab.tech</a>. Доступ зазвичай продовжується до закінчення активного періоду оплати після скасування.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>4. Відшкодування та підтримка виставлення рахунків</h2>
          <p>Запити на відшкодування розглядаються в індивідуальному порядку для дублювання платежів, випадкових покупок, проблем з оформленням замовлення або доступу, або інших проблем з виставленням рахунків. Для отримання деталей див. <a href="/refund-policy/" style={{ color: 'var(--teal-500)' }}>Політику повернення</a>.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>5. Прийнятне використання</h2>
          <p>Ви погоджуєтесь не завантажувати дані, які вам не належать, не намагатися здійснити зворотний інжиніринг сервісу та не використовувати VITALOOP в будь-яких незаконних цілях.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>6. Обмеження відповідальності</h2>
          <p>VITALOOP надається "як є". Ми не несемо відповідальність за будь-які результати стану здоров'я, фінансові втрати або збитки, що виникають від використання цього сервісу. Використання на вашу власну відповідальність.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>7. Зміни в умовах</h2>
          <p>Ми можемо оновити ці умови в будь-який час. Продовження використання після змін означає прийняття.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>8. Контакти</h2>
          <p>Запити щодо підтримки, виставлення рахунків, приватності та юридичних питань: <a href="mailto:info@softdab.tech" style={{ color: 'var(--teal-500)' }}>info@softdab.tech</a></p>
          <p><a href="/pricing/" style={{ color: 'var(--teal-500)' }}>Ціни</a> · <a href="/refund-policy/" style={{ color: 'var(--teal-500)' }}>Політика повернення</a> · <a href="/privacy-policy/" style={{ color: 'var(--teal-500)' }}>Політика приватності</a></p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
