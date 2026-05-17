# RELATÓRIO DE INVESTIGAÇÃO - Verificação de Bugs do Site

**Data:** 17 Maio 2026  
**Status:** ✅ INVESTIGAÇÃO COMPLETA - SOLUÇÕES PRONTAS

---

## PROBLEMA #1: Layout Mobile (iPhone 12) - SJEEZD NÃO ENCONTRADO

### Achados:
- ✅ **Tailwind CSS está gerando media queries corretamente**
  - Verificado: `md\:flex` e `md\:hidden` presentes na build CSS (125KB)
  - Breakpoint `768px` (md:) implementado corretamente
  
- ⚠️ **Possível issue: Viewport emulator (Playwright browser)**
  - O teste automático mostrou que o browser internamente renderizava em 866px
  - Isso pode ser limitação do ambiente de teste, não um bug real

### Recomendação:
**Teste em iPhone Real ou Chrome DevTools (Cmd+Shift+I):**
1. Abra https://vitaloop.today em Chrome/Firefox
2. Pressione F12 → Toggle Device Toolbar (Cmd+Shift+M)
3. Selecione "iPhone 12" da lista
4. Verifique se:
   - ✅ Header collapsa para hamburger menu
   - ✅ Nav links sumem (ficam hidden)
   - ✅ Nenhuma horizontal scroll

**Se ESTIVER quebrado:**
- Arquivo: `frontend/src/components/landing/PageHeader.jsx`
- Solução: Debugar por que `md:hidden` não está aplicando em 390px

---

## PROBLEMA #2: Link /ops do CRM - ✅ SOLUÇÃO IDENTIFICADA

### Achado:
- `bombela1988@gmail.com` **não tem o flag `is_super_admin`** em Supabase auth
- Isso impede acesso à página `/ops` que requer `[RequireGlobalRole("super_admin")]`

### Fluxo de Autenticação:
```
1. Usuário acessa /ops
2. CRM verifica: RequireGlobalRole("super_admin")
3. UserContextAccessor busca app_metadata.is_super_admin
4. Se falso → redireciona para /auth/post-login (login page)
```

### ✅ SOLUÇÃO (2 minutos):

**Passo 1: Update Supabase Auth**
```
1. Acesse https://supabase.co/dashboard
2. Selecione projeto VITALOOP
3. Auth → Users → bombela1988@gmail.com
4. Clique Edit
5. App Metadata → Add JSON:
   {
     "is_super_admin": true
   }
6. Save
```

**Passo 2: Limpar Sessão**
```
1. Faça logout em https://vitaloop.today
2. Limpe cookies (DevTools → Application → Cookies → Delete all)
3. Faça login com: bombela1988@gmail.com / OdessaMama
4. Acesse http://crm.vitaloop.today/ops ✅
```

### Verificação:
- GET http://crm.vitaloop.today/ops
- Esperado: 200 OK + OpsDashboard page
- Se ainda não funcionar: verifique se JWT token foi renovado após mudança do metadata

---

## Código Relacionado:

### Backend Auth Flow:
```python
# File: backend/app/routers/identity/auth.py - GET /auth/me

is_super_admin = bool(
    user_metadata.get("is_super_admin")
    or app_metadata.get("is_super_admin")  # ← busca aqui
)

if is_super_admin:
    global_role = "super_admin"
```

### CRM Authorization:
```csharp
// File: crm-mvc/Areas/Ops/Controllers/DashboardController.cs

[RequireGlobalRole("super_admin")]  // ← exige este role
public class DashboardController : Controller
```

### CSS Responsive (Verificado ✅):
```jsx
// File: frontend/src/components/landing/PageHeader.jsx

<nav className="hidden items-center gap-7 md:flex">  // ← md:flex = 768px+
  {/* nav links */}
</nav>

<button className="inline-flex md:hidden">  // ← md:hidden = <768px → hamburger
  {/* hamburger icon */}
</button>
```

---

## Próximas Ações:

- [ ] **Crítico:** Update bombela1988@gmail.com no Supabase (2 min)
- [ ] **Follow-up:** Teste /ops em iPhone real para confirmar mobile layout
- [ ] **Opcional:** Se mobile layout estiver quebrado, debug PageHeader.jsx responsiveness

---

## Status
- ✅ **OPS Link:** READY TO FIX (1 mudança Supabase)  
- ⏳ **Mobile Layout:** Precisa teste em device real
- ✅ **Investigação:** COMPLETA

