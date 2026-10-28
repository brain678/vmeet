# Admin Dashboard - Quick Reference

## 🎯 Main Components

### Dashboard (`/dashboard`)
```
Welcome Banner
    ↓
Stats Cards (4 cards)
    ↓
Quick Actions (5 cards)
    ↓
Getting Started Guide
```

### Courses (`/dashboard/courses`) ⭐ PRIMARY FEATURE
```
Header + Add Button
    ↓
Filter Section (Search, Department, Level)
    ↓
Courses Table
    ↓
Modal Form (Add/Edit)
```

### Departments (`/dashboard/departments`)
```
Header + Add Button
    ↓
Search Bar
    ↓
Department Cards Grid
    ↓
Modal Form
```

### Levels (`/dashboard/levels`)
```
Header + Add Button
    ↓
Level Cards Grid
    ↓
Reference Guide
    ↓
Modal Form
```

## 🎨 Key Color Codes

| Color | Use | Hex |
|-------|-----|-----|
| Blue | Primary, Courses | #2563EB |
| Purple | Departments | #A855F7 |
| Green | Levels | #16A34A |
| Orange | Users | #EA580C |
| Red | Delete, Danger | #DC2626 |

## 📝 Form Field Types

```typescript
// Text Input
<input type="text" placeholder="Enter text" />

// Number Input
<input type="number" min="1" max="6" />

// Textarea
<textarea rows={3} placeholder="Enter description" />

// Select/Dropdown
<select>
  <option value="">Select Option</option>
  <option value="1">Option 1</option>
</select>
```

## 🔄 Common Patterns

### Form Handling
```typescript
const [formData, setFormData] = useState({
  code: '',
  title: '',
  // ...
});

const handleInputChange = (field: string, value: string | number) => {
  setFormData({...formData, [field]: value});
};
```

### CRUD Operations
```typescript
// Create
const handleAdd = () => {
  setCourses([...courses, newItem]);
};

// Read
const filteredItems = courses.filter(/*...*/);

// Update
const handleEdit = (id: string) => {
  setCourses(courses.map(item =>
    item.id === id ? {...item, ...updates} : item
  ));
};

// Delete
const handleDelete = (id: string) => {
  setCourses(courses.filter(item => item.id !== id));
};
```

### Modal Toggle
```typescript
const [showModal, setShowModal] = useState(false);

const openModal = () => setShowModal(true);
const closeModal = () => setShowModal(false);
```

## 🎯 Tailwind Classes Used

### Spacing
- `px-4` - Horizontal padding (1rem)
- `py-2` - Vertical padding (0.5rem)
- `mb-4` - Margin bottom
- `space-x-2` - Horizontal gap between items

### Colors
- `bg-blue-600` - Background color
- `text-gray-900` - Text color
- `border-gray-300` - Border color
- `hover:bg-blue-700` - Hover state

### Layout
- `flex` - Flexbox
- `grid` - CSS Grid
- `grid-cols-1` - 1 column (mobile)
- `md:grid-cols-2` - 2 columns (tablet)
- `lg:grid-cols-3` - 3 columns (desktop)

### Effects
- `rounded-lg` - Border radius
- `shadow-sm` - Light shadow
- `hover:shadow-xl` - Hover shadow
- `transition` - Smooth transitions
- `duration-300` - 300ms duration

## 📊 State Management Template

```typescript
// State declarations
const [items, setItems] = useState<Item[]>([]);
const [showModal, setShowModal] = useState(false);
const [editingId, setEditingId] = useState<string | null>(null);
const [formData, setFormData] = useState({/* defaults */});
const [searchTerm, setSearchTerm] = useState('');

// Load data
useEffect(() => {
  loadData(); // or fetch from API
}, []);

// Filtering
const filtered = items.filter(item =>
  item.name.toLowerCase().includes(searchTerm.toLowerCase())
);

// Add/Edit/Delete logic
const handleSave = () => {
  if (editingId) {
    setItems(items.map(item =>
      item.id === editingId ? {...item, ...formData} : item
    ));
  } else {
    setItems([...items, {id: Date.now().toString(), ...formData}]);
  }
  setShowModal(false);
};

const handleDelete = (id: string) => {
  if (confirm('Are you sure?')) {
    setItems(items.filter(item => item.id !== id));
  }
};
```

## 🔗 Route Structure

```
/dashboard
├── /courses
│   └── page.tsx (Course CRUD)
├── /departments
│   └── page.tsx (Department CRUD)
├── /levels
│   └── page.tsx (Level CRUD)
├── /users
│   └── page.tsx (User Management)
└── /settings
    └── page.tsx (System Settings)
```

## 📱 Responsive Breakpoints

- **Mobile**: < 768px (single column, `grid-cols-1`)
- **Tablet**: 768px - 1024px (2 columns, `md:grid-cols-2`)
- **Desktop**: > 1024px (3+ columns, `lg:grid-cols-3`)

## 🧩 Reusable Components

### From AdminUIComponents.tsx

```typescript
// Stat Card
<StatCard 
  title="Courses" 
  count={0} 
  icon="📚" 
  color="blue" 
/>

// Modal
<Modal
  isOpen={showModal}
  title="Course"
  onClose={() => setShowModal(false)}
  onSubmit={handleSave}
  color="blue"
>
  {/* Form fields */}
</Modal>

// Form Field
<FormField
  label="Course Code"
  required={true}
  value={formData.code}
  onChange={(val) => setFormData({...formData, code: val})}
/>

// Alert
<Alert
  type="error"
  message="Failed to save"
  onClose={() => setError(null)}
/>
```

## 🚀 Performance Tips

1. **Use keys in lists**
   ```typescript
   {items.map(item => <div key={item.id}>{item.name}</div>)}
   ```

2. **Memoize callbacks if needed**
   ```typescript
   const handleSave = useCallback(() => {/*...*/}, [dependencies]);
   ```

3. **Lazy load data**
   ```typescript
   const [loading, setLoading] = useState(true);
   useEffect(() => { loadData(); }, []);
   ```

4. **Filter client-side for small datasets**
   ```typescript
   const filtered = items.filter(/*condition*/);
   ```

## 🔐 Security Reminders

- [ ] Validate all user inputs
- [ ] Check authentication on each page
- [ ] Sanitize data before display
- [ ] Use HTTPS in production
- [ ] Implement CSRF protection
- [ ] Add rate limiting
- [ ] Log all admin actions
- [ ] Use environment variables for secrets

## 🐛 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Modal not closing | State not updating | Check setState syntax |
| Filters not working | Comparison error | Use `.toLowerCase()` |
| Styles not applied | Class name typo | Check Tailwind syntax |
| Data not saving | No API call | Implement API endpoint |
| Page blank | Missing return | Check JSX closing |

## 📚 Documentation Files

- `ADMIN_DASHBOARD_GUIDE.md` - Full feature guide
- `API_INTEGRATION_GUIDE.md` - Backend integration
- `ADMIN_DASHBOARD_SUMMARY.md` - Implementation summary
- This file - Quick reference

## 🎯 Next Steps

1. **Test the dashboard**
   - Run `npm run dev` in admin folder
   - Try all CRUD operations

2. **Connect to backend**
   - Follow `API_INTEGRATION_GUIDE.md`
   - Replace mock data with API calls

3. **Customize**
   - Adjust colors and styling
   - Add new fields/features
   - Modify validation logic

4. **Deploy**
   - Set environment variables
   - Run build: `npm run build`
   - Deploy to hosting platform

## 🔗 Useful Links

- Next.js Docs: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- React Hooks: https://react.dev/reference/react/hooks
- TypeScript: https://www.typescriptlang.org/docs

## 📞 File Paths

| What | Path |
|------|------|
| Dashboard | `admin/app/dashboard/page.tsx` |
| Courses | `admin/app/dashboard/courses/page.tsx` |
| Departments | `admin/app/dashboard/departments/page.tsx` |
| Levels | `admin/app/dashboard/levels/page.tsx` |
| Components | `admin/components/AdminUIComponents.tsx` |
| Config | `admin/next.config.mjs` |
| Styles | `admin/app/globals.css` |

---

**Quick Reference v1.0** | Updated: Dec 2024
