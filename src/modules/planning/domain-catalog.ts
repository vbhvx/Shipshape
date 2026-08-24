import { RouteSpecification, FeatureSpecification, DataEntitySpecification } from '@/types';

export interface DomainDefinition {
  domainId: 'todo' | 'kanban' | 'ecommerce' | 'finance' | 'crm' | 'notes' | 'fitness' | 'general';
  domainTitle: string;
  domainSubtitle: string;
  entityName: string;
  entityDescription: string;
  fields: { name: string; type: string; required: boolean; description: string }[];
  additionalEntities?: DataEntitySpecification[];
  seedItems: Array<Record<string, any>>;
  kpiCards: { label: string; key: string; format?: 'count' | 'currency' | 'percent' | 'badge'; subtext: string }[];
  primaryActionLabel: string;
  accentColor: string; // Tailwind class, e.g. 'emerald' | 'indigo' | 'amber' | 'violet' | 'sky'
  accentHex: string;
  routes: RouteSpecification[];
  features: FeatureSpecification[];
}

/**
 * Accurately analyzes the natural language prompt into a tailored domain specification.
 */
export function inferDomain(prompt: string, projectName: string): DomainDefinition {
  const p = `${prompt} ${projectName}`.toLowerCase();

  // 1. Todo / Checklist / Habits / Tasks
  const isTodo =
    p.includes('todo') ||
    p.includes('to-do') ||
    p.includes('to do') ||
    p.includes('checklist') ||
    p.includes('task list') ||
    p.includes('reminders') ||
    p.includes('daily task') ||
    p.includes('habit');

  if (isTodo) {
    return {
      domainId: 'todo',
      domainTitle: 'Task & Checklist Manager',
      domainSubtitle: 'Interactive todo list with category tagging, priority flags, and completion tracking.',
      entityName: 'TodoItem',
      entityDescription: 'Actionable todo task with status, priority, and category',
      fields: [
        { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
        { name: 'title', type: 'string', required: true, description: 'Task title' },
        { name: 'category', type: 'string', required: true, description: 'Category (Work, Personal, Health, DevOps)' },
        { name: 'priority', type: 'string', required: true, description: 'low | medium | high | urgent' },
        { name: 'status', type: 'string', required: true, description: 'todo | done' },
        { name: 'dueDate', type: 'string', required: false, description: 'Due date' },
        { name: 'completed', type: 'boolean', required: true, description: 'Whether the task is finished' },
        { name: 'createdAt', type: 'string', required: true, description: 'Created timestamp' },
      ],
      seedItems: [
        {
          id: 'todo-1',
          title: 'Review pull request #42 and run unit test suite',
          category: 'Work',
          priority: 'urgent',
          status: 'todo',
          completed: false,
          dueDate: 'Today',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'todo-2',
          title: 'Buy weekly groceries & meal prep ingredients',
          category: 'Personal',
          priority: 'high',
          status: 'done',
          completed: true,
          dueDate: 'Yesterday',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'todo-3',
          title: 'Draft quarterly product roadmap & OKR presentation',
          category: 'Work',
          priority: 'high',
          status: 'todo',
          completed: false,
          dueDate: 'Tomorrow',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'todo-4',
          title: 'Schedule annual dental checkup & teeth cleaning',
          category: 'Health',
          priority: 'medium',
          status: 'done',
          completed: true,
          dueDate: 'Completed',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'todo-5',
          title: 'Renew server domain registration and SSL certificates',
          category: 'DevOps',
          priority: 'low',
          status: 'todo',
          completed: false,
          dueDate: 'Next week',
          createdAt: new Date().toISOString(),
        },
      ],
      kpiCards: [
        { label: 'Total Tasks', key: 'total', format: 'count', subtext: 'In your workspace' },
        { label: 'Completed', key: 'completed', format: 'count', subtext: 'Marked as done' },
        { label: 'Pending Action', key: 'pending', format: 'count', subtext: 'Remaining tasks' },
        { label: 'Completion Rate', key: 'rate', format: 'percent', subtext: 'Weekly productivity' },
      ],
      primaryActionLabel: '+ Add Task',
      accentColor: 'emerald',
      accentHex: '#10b981',
      routes: [
        { path: '/', name: 'All Tasks', description: 'Active checklist and quick-add form', isProtected: false },
        { path: '/explore', name: 'Task Explorer', description: 'Search, filter by category/priority, and CSV export', isProtected: false },
        { path: '/analytics', name: 'Productivity Insights', description: 'Completion rates and priority distribution charts', isProtected: false },
        { path: '/settings', name: 'Preferences', description: 'Theme settings, clear completed, and data backup', isProtected: false },
      ],
      features: [
        { id: 'feat_crud', name: 'Interactive Checklist Operations', description: 'Toggle task completion, edit title, and delete', category: 'core', status: 'planned' },
        { id: 'feat_filter', name: 'Multi-criteria Filters & Search', description: 'Instant filter by Active, Completed, or Category', category: 'ui', status: 'planned' },
        { id: 'feat_persist', name: 'Zero-loss Local Storage', description: 'Browser persistence surviving reloads', category: 'data', status: 'planned' },
        { id: 'feat_export', name: 'CSV Task Export', description: 'Download task list in standard spreadsheet format', category: 'core', status: 'planned' },
      ],
    };
  }

  // 2. Finance / Expenses / Budget / Spending
  const isFinance =
    p.includes('expense') ||
    p.includes('budget') ||
    p.includes('finance') ||
    p.includes('spending') ||
    p.includes('money') ||
    p.includes('wallet') ||
    p.includes('accounting') ||
    p.includes('invoice');

  if (isFinance) {
    return {
      domainId: 'finance',
      domainTitle: 'Expense & Budget Intelligence',
      domainSubtitle: 'Track operational expenses, categorize spending, and inspect financial metrics.',
      entityName: 'ExpenseItem',
      entityDescription: 'Financial transaction record with category and amount',
      fields: [
        { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
        { name: 'title', type: 'string', required: true, description: 'Transaction vendor or note' },
        { name: 'category', type: 'string', required: true, description: 'Category (Food, Cloud, Software, Travel)' },
        { name: 'amount', type: 'number', required: true, description: 'Amount in USD' },
        { name: 'type', type: 'string', required: true, description: 'expense | income' },
        { name: 'status', type: 'string', required: true, description: 'settled | pending' },
        { name: 'date', type: 'string', required: true, description: 'Transaction date' },
        { name: 'createdAt', type: 'string', required: true, description: 'Recorded timestamp' },
      ],
      seedItems: [
        { id: 'exp-1', title: 'Whole Foods Market', category: 'Food', amount: 84.5, type: 'expense', status: 'settled', date: 'Yesterday', createdAt: new Date().toISOString() },
        { id: 'exp-2', title: 'AWS Cloud Hosting & Database', category: 'Software', amount: 62.4, type: 'expense', status: 'settled', date: '3 days ago', createdAt: new Date().toISOString() },
        { id: 'exp-3', title: 'Client Consulting Retainer', category: 'Income', amount: 1850.0, type: 'income', status: 'settled', date: 'This week', createdAt: new Date().toISOString() },
        { id: 'exp-4', title: 'Metro Transit Monthly Pass', category: 'Travel', amount: 90.0, type: 'expense', status: 'settled', date: '5 days ago', createdAt: new Date().toISOString() },
        { id: 'exp-5', title: 'GitHub Enterprise Subscription', category: 'Software', amount: 21.0, type: 'expense', status: 'settled', date: '1 week ago', createdAt: new Date().toISOString() },
      ],
      kpiCards: [
        { label: 'Total Expenses', key: 'total_expenses', format: 'currency', subtext: 'Logged this month' },
        { label: 'Total Income', key: 'total_income', format: 'currency', subtext: 'Inflow received' },
        { label: 'Net Cashflow', key: 'net_balance', format: 'currency', subtext: 'Positive margin' },
        { label: 'Transactions', key: 'total_count', format: 'count', subtext: 'Recorded items' },
      ],
      primaryActionLabel: '+ Log Expense',
      accentColor: 'emerald',
      accentHex: '#059669',
      routes: [
        { path: '/', name: 'Financial Overview', description: 'Spending breakdown, balance summary, and quick log', isProtected: false },
        { path: '/explore', name: 'Transaction Ledger', description: 'Filterable table with search, category totals, and export', isProtected: false },
        { path: '/analytics', name: 'Spending Analytics', description: 'Category distribution breakdown and monthly trajectory', isProtected: false },
        { path: '/settings', name: 'Settings & Budgets', description: 'Currency settings, monthly limits, and JSON backup', isProtected: false },
      ],
      features: [
        { id: 'feat_crud', name: 'Transaction Management', description: 'Log expenses and income with instant updates', category: 'core', status: 'planned' },
        { id: 'feat_analytics', name: 'Budget vs Actuals Tracking', description: 'Dynamic spending metrics and charts', category: 'ui', status: 'planned' },
        { id: 'feat_export', name: 'Financial CSV Export', description: 'Export records for tax or accounting software', category: 'core', status: 'planned' },
        { id: 'feat_persist', name: 'Local Ledger Persistence', description: 'Reliable offline-first balance storage', category: 'data', status: 'planned' },
      ],
    };
  }

  // 3. E-Commerce / Store / Catalog / Boutique
  const isEcommerce =
    p.includes('store') ||
    p.includes('shop') ||
    p.includes('cart') ||
    p.includes('product') ||
    p.includes('boutique') ||
    p.includes('fragrance') ||
    p.includes('merch') ||
    p.includes('ecommerce') ||
    p.includes('catalog');

  if (isEcommerce) {
    return {
      domainId: 'ecommerce',
      domainTitle: 'Boutique Store & Product Catalog',
      domainSubtitle: 'Product inventory showcase with category filtering, cart calculation, and stock tracking.',
      entityName: 'Product',
      entityDescription: 'Retail product catalog entry with pricing, rating, and inventory',
      additionalEntities: [
        {
          name: 'CartItem',
          description: 'Line item in user shopping cart linked to a product',
          fields: [
            { name: 'id', type: 'string', required: true, description: 'Unique cart item identifier' },
            { name: 'productId', type: 'string', required: true, description: 'Referenced product SKU' },
            { name: 'quantity', type: 'number', required: true, description: 'Quantity selected' },
            { name: 'price', type: 'number', required: true, description: 'Unit price' },
          ],
        },
      ],
      fields: [
        { name: 'id', type: 'string', required: true, description: 'SKU or unique ID' },
        { name: 'title', type: 'string', required: true, description: 'Product name' },
        { name: 'category', type: 'string', required: true, description: 'Department' },
        { name: 'price', type: 'number', required: true, description: 'Price in USD' },
        { name: 'rating', type: 'number', required: true, description: 'Average rating 1-5' },
        { name: 'stock', type: 'number', required: true, description: 'Available inventory units' },
        { name: 'status', type: 'string', required: true, description: 'in_stock | low_stock | sold_out' },
      ],
      seedItems: [
        { id: 'prod-1', title: 'Artisan Pour-Over Ceramic Dripper', category: 'Brewing', price: 38.0, rating: 4.9, stock: 24, status: 'in_stock' },
        { id: 'prod-2', title: 'Ethiopia Yirgacheffe Single-Origin Beans', category: 'Coffee', price: 22.5, rating: 4.8, stock: 18, status: 'in_stock' },
        { id: 'prod-3', title: 'Precision Digital Gram Scale', category: 'Equipment', price: 45.0, rating: 4.7, stock: 8, status: 'low_stock' },
        { id: 'prod-4', title: 'Double-Walled Insulated Glass Tumbler', category: 'Drinkware', price: 28.0, rating: 4.9, stock: 32, status: 'in_stock' },
      ],
      kpiCards: [
        { label: 'Catalog Items', key: 'total_items', format: 'count', subtext: 'Active SKUs' },
        { label: 'Units in Stock', key: 'total_stock', format: 'count', subtext: 'Available inventory' },
        { label: 'Average Rating', key: 'avg_rating', format: 'badge', subtext: 'Customer satisfaction' },
        { label: 'Catalog Value', key: 'inventory_value', format: 'currency', subtext: 'Total stock worth' },
      ],
      primaryActionLabel: '+ Add Product',
      accentColor: 'amber',
      accentHex: '#d97706',
      routes: [
        { path: '/', name: 'Storefront', description: 'Product grid, category filters, and live shopping cart', isProtected: false },
        { path: '/explore', name: 'Inventory Manager', description: 'Search inventory, restock items, and export catalog', isProtected: false },
        { path: '/analytics', name: 'Sales Analytics', description: 'Revenue metrics, inventory turnover, and rating trends', isProtected: false },
        { path: '/settings', name: 'Store Settings', description: 'Currency, shipping rates, and stock alerts', isProtected: false },
      ],
      features: [
        { id: 'feat_crud', name: 'Product Catalog Operations', description: 'Create and update products with inventory sync', category: 'core', status: 'planned' },
        { id: 'feat_cart', name: 'Shopping Cart Calculation', description: 'Live quantity adjustments and subtotal compute', category: 'core', status: 'planned' },
        { id: 'feat_inventory', name: 'Inventory Management', description: 'Update stock levels with low-stock warnings', category: 'core', status: 'planned' },
        { id: 'feat_export', name: 'Catalog CSV Export', description: 'Download complete inventory catalog', category: 'core', status: 'planned' },
      ],
    };
  }

  // 4. Notes / Knowledge Base / Wiki
  const isNotes =
    p.includes('note') ||
    p.includes('docs') ||
    p.includes('wiki') ||
    p.includes('journal') ||
    p.includes('diary') ||
    p.includes('markdown');

  if (isNotes) {
    return {
      domainId: 'notes',
      domainTitle: 'Knowledge Base & Notes Organizer',
      domainSubtitle: 'Fast markdown note taking with tagging, full-text search, and pin controls.',
      entityName: 'NoteItem',
      entityDescription: 'Markdown document note with tags and pin state',
      fields: [
        { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
        { name: 'title', type: 'string', required: true, description: 'Note headline' },
        { name: 'category', type: 'string', required: true, description: 'Folder or topic' },
        { name: 'content', type: 'string', required: true, description: 'Body text' },
        { name: 'status', type: 'string', required: true, description: 'pinned | archived | active' },
        { name: 'updatedAt', type: 'string', required: true, description: 'Last modified date' },
      ],
      seedItems: [
        { id: 'note-1', title: 'Sprint Retrospective Key Takeaways', category: 'Engineering', content: 'Focus on reducing PR turnaround time. Adopt unified Prisma migrations across all branches.', status: 'pinned', updatedAt: 'Today' },
        { id: 'note-2', title: 'Book Recommendations 2026', category: 'Reading', content: 'Designing Data-Intensive Applications, The Architecture of Open Source, Atomic Habits.', status: 'active', updatedAt: '2 days ago' },
        { id: 'note-3', title: 'Sourdough Bread Hydration Formula', category: 'Recipes', content: '75% hydration formula with 20% levain and 2% sea salt. 4-hour bulk fermentation at 26C.', status: 'active', updatedAt: '4 days ago' },
      ],
      kpiCards: [
        { label: 'Total Notes', key: 'total_notes', format: 'count', subtext: 'Documents created' },
        { label: 'Pinned Items', key: 'pinned_notes', format: 'count', subtext: 'Quick access notes' },
        { label: 'Categories', key: 'category_count', format: 'count', subtext: 'Organized notebooks' },
        { label: 'Word Count', key: 'word_count', format: 'count', subtext: 'Total knowledge size' },
      ],
      primaryActionLabel: '+ New Note',
      accentColor: 'violet',
      accentHex: '#7c3aed',
      routes: [
        { path: '/', name: 'All Notes', description: 'Grid of notes with quick editor and search', isProtected: false },
        { path: '/explore', name: 'Notebook Explorer', description: 'Categorized document directory and tag filters', isProtected: false },
        { path: '/analytics', name: 'Writing Analytics', description: 'Word counts, writing streak, and activity trends', isProtected: false },
        { path: '/settings', name: 'Editor Settings', description: 'Font preferences, markdown shortcuts, and backup', isProtected: false },
      ],
      features: [
        { id: 'feat_notes', name: 'Markdown Document Editor', description: 'Create and edit notes with immediate autosave', category: 'core', status: 'planned' },
        { id: 'feat_search', name: 'Full-text Search & Tags', description: 'Instant fuzzy matching on titles and content', category: 'ui', status: 'planned' },
      ],
    };
  }

  // 5. CRM / Deals / Pipeline / Sales
  const isCrm =
    p.includes('crm') ||
    p.includes('lead') ||
    p.includes('deal') ||
    p.includes('pipeline') ||
    p.includes('sales') ||
    p.includes('contact');

  if (isCrm) {
    return {
      domainId: 'crm',
      domainTitle: 'Venture Deal Pipeline & CRM',
      domainSubtitle: 'Manage customer accounts, stages, deal size, and probability tracking.',
      entityName: 'DealItem',
      entityDescription: 'Customer or venture deal record in pipeline',
      fields: [
        { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
        { name: 'title', type: 'string', required: true, description: 'Company or deal name' },
        { name: 'category', type: 'string', required: true, description: 'Industry or sector' },
        { name: 'value', type: 'number', required: true, description: 'Deal size in USD' },
        { name: 'status', type: 'string', required: true, description: 'lead | discovery | proposal | closed_won' },
        { name: 'contact', type: 'string', required: true, description: 'Primary contact name' },
      ],
      seedItems: [
        { id: 'crm-1', title: 'Acme Robotics Seed Participation', category: 'Robotics', value: 75000, status: 'proposal', contact: 'Elena Vance' },
        { id: 'crm-2', title: 'Hyperion AI Enterprise Pilot', category: 'AI Infrastructure', value: 140000, status: 'discovery', contact: 'David Chen' },
        { id: 'crm-3', title: 'Northwind Logistics API Contract', category: 'Supply Chain', value: 45000, status: 'closed_won', contact: 'Marcus Croft' },
      ],
      kpiCards: [
        { label: 'Pipeline Value', key: 'pipeline_value', format: 'currency', subtext: 'Active deal potential' },
        { label: 'Active Deals', key: 'active_deals', format: 'count', subtext: 'In active negotiation' },
        { label: 'Closed Won', key: 'closed_won', format: 'currency', subtext: 'Secured revenue' },
        { label: 'Win Rate', key: 'win_rate', format: 'percent', subtext: 'Historical conversion' },
      ],
      primaryActionLabel: '+ New Deal',
      accentColor: 'indigo',
      accentHex: '#4f46e5',
      routes: [
        { path: '/', name: 'Deal Pipeline', description: 'Pipeline overview, stage distribution, and quick add', isProtected: false },
        { path: '/explore', name: 'Contacts Directory', description: 'Full customer table with search, filters, and export', isProtected: false },
        { path: '/analytics', name: 'Sales Performance', description: 'Stage velocity, win rates, and forecast projection', isProtected: false },
        { path: '/settings', name: 'Pipeline Configuration', description: 'Stage definitions, probability weights, and backup', isProtected: false },
      ],
      features: [
        { id: 'feat_crud', name: 'Deal Lifecycle Management', description: 'Transition deals across discovery, proposal, and closed', category: 'core', status: 'planned' },
        { id: 'feat_crm', name: 'Pipeline Stages & Velocity', description: 'Monitor stage conversion and deal value totals', category: 'core', status: 'planned' },
        { id: 'feat_filter', name: 'Directory Search & Filters', description: 'Instant filter by status stage and category', category: 'ui', status: 'planned' },
        { id: 'feat_export', name: 'Pipeline CSV Export', description: 'Download deal ledger for CRM synchronization', category: 'core', status: 'planned' },
      ],
    };
  }

  // 6. Default / Kanban / General Workflow
  const isKanban = p.includes('kanban') || p.includes('board') || p.includes('sprint') || p.includes('agile') || p.includes('task');
  const domainTitle = isKanban ? 'SprintFlow Kanban Board' : `${projectName || 'Project'} Operations Hub`;
  const domainSubtitle = isKanban
    ? 'Visual task workflow with drag-and-drop status stages, priority tags, and velocity metrics.'
    : 'Full-stack workspace with real-time state persistence, multi-criteria filtering, and data export.';

  return {
    domainId: isKanban ? 'kanban' : 'general',
    domainTitle,
    domainSubtitle,
    entityName: isKanban ? 'TaskItem' : 'RecordItem',
    entityDescription: 'Primary tracked workflow record',
    fields: [
      { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
      { name: 'title', type: 'string', required: true, description: 'Item title' },
      { name: 'category', type: 'string', required: true, description: 'Classification tag' },
      { name: 'status', type: 'string', required: true, description: isKanban ? 'backlog | in_progress | review | done' : 'active | pending | archived' },
      { name: 'priority', type: 'string', required: true, description: 'low | medium | high | urgent' },
      { name: 'assignee', type: 'string', required: false, description: 'Assigned member' },
    ],
    seedItems: isKanban
      ? [
          { id: 'task-1', title: 'Implement Authentication Flow & JWT Tokens', category: 'Core', status: 'done', priority: 'high', assignee: 'Sarah C.' },
          { id: 'task-2', title: 'Design System Dark-Mode Token Palette', category: 'UI', status: 'in_progress', priority: 'medium', assignee: 'Alex R.' },
          { id: 'task-3', title: 'Database Schema Migrations & Indexing', category: 'Database', status: 'review', priority: 'urgent', assignee: 'John D.' },
          { id: 'task-4', title: 'Automated Diagnostic Error Recovery Engine', category: 'Agent', status: 'backlog', priority: 'high', assignee: 'Maya L.' },
        ]
      : [
          { id: 'rec-1', title: 'System Architecture Specification', category: 'Architecture', status: 'active', priority: 'high', assignee: 'Alex R.' },
          { id: 'rec-2', title: 'Component Library & Tailwind Tokens', category: 'Frontend', status: 'active', priority: 'medium', assignee: 'Sarah C.' },
          { id: 'rec-3', title: 'RESTful Route Handlers & Type Validation', category: 'Backend', status: 'active', priority: 'urgent', assignee: 'John D.' },
        ],
    kpiCards: [
      { label: 'Total Items', key: 'total_items', format: 'count', subtext: 'In your workspace' },
      { label: 'In Progress', key: 'in_progress', format: 'count', subtext: 'Active operations' },
      { label: 'Completed', key: 'completed_items', format: 'count', subtext: 'Finished milestones' },
      { label: 'Health Score', key: 'health_score', format: 'percent', subtext: 'All systems nominal' },
    ],
    primaryActionLabel: isKanban ? '+ New Card' : '+ Add Record',
    accentColor: isKanban ? 'indigo' : 'emerald',
    accentHex: isKanban ? '#4f46e5' : '#10b981',
    routes: [
      { path: '/', name: isKanban ? 'Sprint Board' : 'Dashboard Overview', description: 'Main operational workspace and quick record creator', isProtected: false },
      { path: '/explore', name: 'Data Explorer', description: 'Comprehensive data records table with search and CSV export', isProtected: false },
      { path: '/analytics', name: 'Metrics & Telemetry', description: 'Visual performance metrics and distribution charts', isProtected: false },
      { path: '/settings', name: 'Preferences', description: 'Application configuration, reset storage, and backup', isProtected: false },
    ],
    features: [
      { id: 'feat_crud', name: 'Interactive Record Operations', description: 'Create, update, search, and delete items with immediate state persistence', category: 'core', status: 'planned' },
      { id: 'feat_filter', name: 'Fuzzy Search & Filters', description: 'Client-side search and category filtering', category: 'ui', status: 'planned' },
      { id: 'feat_persist', name: 'Zero-loss Persistence', description: 'Browser local storage synchronization with fallback in-memory state', category: 'data', status: 'planned' },
      { id: 'feat_export', name: 'Data Export to CSV', description: 'One-click export of data records in CSV format', category: 'core', status: 'planned' },
    ],
  };
}
