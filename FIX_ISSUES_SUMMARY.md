# Soluções para os Dois Problemas

## 1. FIX: Link OPS (/ops) - Acesso Super Admin

**PROBLEMA:** A página `http://crm.vitaloop.today/ops` requer que o usuário tenha a role `super_admin`, mas `bombela1988@gmail.com` não a possui.

### SOLUÇÃO - 2 Passos:

#### Step 1: Defina `is_super_admin` em Supabase Auth

1. Acesse: https://supabase.co/dashboard
2. Selecione o projeto VITALOOP
3. Vá para: **Authentication → Users**
4. Procure por: `bombela1988@gmail.com`
5. Clique no usuário
6. Edite o campo **App Metadata** e adicione:
```json
{
  "is_super_admin": true
}
```
7. Clique **Save**

#### Step 2: Limpe o cache de sessão
- Faça logout em https://vitaloop.today
- Faça login novamente com bombela1988@gmail.com / OdessaMama
- Acesse http://crm.vitaloop.today/ops ✅

### Por Que Isso Funciona?
- O backend verifica `app_metadata.is_super_admin` via `/auth/me`
- O CRM verifica esse flag via `RequireGlobalRole` attribute
- Definindo `is_super_admin: true` concede acesso global ao `/ops`

---

## 2. FIX: Layout Mobile (iPhone 12) - Em Desenvolvimento

**PROBLEMA:** O header e alguns componentes não estão sendo responsivos no viewport de 390px (iPhone 12).

### ACHADOS:
- ✅ PageHeader.jsx tem classes Tailwind responsivas corretas
- ⚠️ Múltiplas páginas usam `window.innerWidth < 500` hardcoded em vez de classes CSS
- ⚠️ Possível issue com breakpoints de Tailwind não sendo compilados corretamente

### AÇÕES NECESSÁRIAS:
1. Auditar CSS compilation de Tailwind
2. Verificar se `md:` breakpoint (768px) está sendo gerado
3. Padronizar uso de responsive classes vs `window.innerWidth` checks

---

## Status
- ✅ Ops Access: PRONTO PARA IMPLEMENTAR
- ⏳ Mobile Layout: INVESTIGAÇÃO EM PROGRESSO
