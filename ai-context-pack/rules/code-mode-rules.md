# Code Mode Rules

> Rules for when Kilo Code is in "code" mode

---

## 🎯 Code Mode Purpose

Code mode is used when:
- Writing new code or files
- Modifying existing code
- Creating project structures
- Implementing features

---

## ✅ Before Writing Code

1. **Read Context**
   - architecture.md
   - system_identity.md  
   - Relevant module context (e.g., super-admin/context.md)
   - Rules files

2. **Understand Requirements**
   - What needs to be built?
   - What are the constraints?
   - What data models are needed?

3. **Plan Structure**
   - Where should files go?
   - What components are needed?
   - How to organize code?

---

## 📝 Code Standards

### TypeScript
```typescript
// ✅ Good: Clear types
interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
}

// ❌ Bad: Any type
const data: any = getData();
```

### React/Next.js
```typescript
// ✅ Good: Functional component with types
function TenantTable({ tenants }: { tenants: Tenant[] }) {
  return (
    <table>
      {tenants.map(t => <tr key={t.id}>{t.name}</tr>)}
    </table>
  );
}

// ❌ Bad: Inline styles
<div style={{ backgroundColor: 'red' }}>
```

### Tailwind CSS
```tsx
// ✅ Good: Tailwind classes
<div className="p-4 bg-white rounded-lg shadow-sm">

// ❌ Bad: No spacing
<div className="bg-white">
```

---

## 📁 File Creation Rules

1. **Always create files inside CURRENT working directory**
2. **NEVER create files outside the project**
3. **NEVER create parent folders unnecessarily**
4. **Use proper naming conventions**

### Naming
- Folders: `kebab-case` → `super-admin`, `tenant-dashboard`
- Files: `kebab-case` → `mock-data.ts`, `utils.ts`
- Components: `PascalCase` → `TenantTable.tsx`, `ScannerCard.tsx`

---

## 🔧 Common Tasks

### Create New Component
```
1. Create file in src/components/
2. Define props interface
3. Use Tailwind for styling
4. Export as default or named
```

### Add New API Endpoint
```
1. Define TypeScript interface
2. Add to mockData.ts
3. Create UI component
4. Document API contract
```

### Modify Existing Feature
```
1. Read current implementation
2. Understand data flow
3. Make minimal changes
4. Test in browser
```

---

## 🐛 Debugging

When something doesn't work:
1. Check browser console for errors
2. Verify component is rendering
3. Check API responses
4. Review data flow

---

## 📦 Dependencies

When adding new packages:
1. Check if already exists in package.json
2. Use well-maintained packages
3. Consider bundle size
4. Document why it's needed

---

## ✅ Before Finishing

1. ✅ Code compiles without errors
2. ✅ No obvious bugs
3. ✅ Follows naming conventions
4. ✅ Uses proper error handling
5. ✅ Code is clean and readable
