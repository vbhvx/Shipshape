import { z } from 'zod';

export const BenchmarkCategorySchema = z.enum([
  'application_generation',
  'modification_and_regression',
  'error_recovery',
  'cancellation_and_lifecycle',
]);

export type BenchmarkCategory = z.infer<typeof BenchmarkCategorySchema>;

export const AssertionActionSchema = z.enum([
  'navigate',
  'assert_visible',
  'assert_text',
  'assert_count',
  'fill_form',
  'click',
  'check_checkbox',
  'assert_persisted',
  'assert_no_horizontal_overflow',
  'assert_no_console_errors',
]);

export type AssertionAction = z.infer<typeof AssertionActionSchema>;

export const BrowserAssertionStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  action: AssertionActionSchema,
  selector: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  value: z.string().optional(),
  count: z.number().optional(),
  viewport: z.object({ width: z.number(), height: z.number() }).optional(),
  timeoutMs: z.number().optional(),
});

export type BrowserAssertionStep = z.infer<typeof BrowserAssertionStepSchema>;

export const BenchmarkBudgetSchema = z.object({
  maxT0Ms: z.number().default(4000), // Time to initial UI feedback
  maxT1Ms: z.number().default(30000), // Time until real running preview is visible
  maxT2Ms: z.number().default(60000), // Time until Next.js compile succeeds
  maxT3Ms: z.number().default(90000), // Time until functional assertions pass
  maxTokens: z.number().default(25000),
  maxCostUsd: z.number().default(0.05),
  maxRepairAttempts: z.number().default(3),
});

export type BenchmarkBudget = z.infer<typeof BenchmarkBudgetSchema>;

export const BenchmarkScenarioSchema = z.object({
  id: z.string(),
  category: BenchmarkCategorySchema,
  name: z.string(),
  description: z.string(),
  prompt: z.string(),
  followupPrompt: z.string().optional(),
  targetRoutes: z.array(z.object({
    path: z.string(),
    name: z.string(),
    description: z.string(),
  })),
  requiredFeatures: z.array(z.string()),
  functionalAcceptanceCriteria: z.array(z.string()),
  assertions: z.array(BrowserAssertionStepSchema),
  expectedStateTransitions: z.array(z.string()),
  persistenceRequirements: z.object({
    storageType: z.enum(['localStorage', 'indexedDB', 'postgres', 'none']),
    entities: z.array(z.string()),
    survivesReload: z.boolean(),
  }),
  failureConditions: z.array(z.string()),
  budgets: BenchmarkBudgetSchema,
});

export type BenchmarkScenario = z.infer<typeof BenchmarkScenarioSchema>;

/**
 * The 10 Definitive Shipshape Benchmark Scenarios for Phase 4.
 */
export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  // =========================================================================
  // CATEGORY 1: APPLICATION GENERATION (Scenarios 1 - 7)
  // =========================================================================
  {
    id: 'bench_01_saas_landing',
    category: 'application_generation',
    name: 'DevOps Pulse SaaS Landing Page',
    description: 'High-converting SaaS landing page with responsive layouts, anchor navigation, hero, social proof, pricing matrix, and FAQ accordion.',
    prompt: 'Build a modern SaaS landing page for "DevOps Pulse", a real-time Kubernetes observability platform. Include a sticky navigation bar with links to Features, Pricing, Testimonials, and FAQ. The hero section must feature a prominent CTA "Start Free Trial" and "Book Demo". Add a 3-tier pricing table (Starter $29/mo, Team $79/mo, Enterprise Custom) with feature comparison checkboxes and monthly/annual billing toggles. Ensure zero horizontal scroll overflow at 375px mobile and 1280px desktop viewports.',
    targetRoutes: [
      { path: '/', name: 'Home', description: 'Main SaaS landing page' },
      { path: '/pricing', name: 'Pricing', description: 'Detailed pricing and tier comparison' },
    ],
    requiredFeatures: [
      'Sticky Header Navigation with Anchor Links',
      'Hero Section with Dual Action CTAs',
      'Social Proof and Metrics Banner',
      '3-Tier Pricing Comparison Matrix',
      'Monthly vs Annual Billing Toggle',
      'Interactive FAQ Accordion',
      'Footer with Legal & Newsletter Signup',
    ],
    functionalAcceptanceCriteria: [
      'Page renders with valid semantic HTML landmarks (<header>, <main>, <section>, <footer>)',
      'Heading hierarchy contains exactly one <h1> and multiple <h2> section headings',
      'Navigation links smoothly jump to corresponding page sections',
      'Billing toggle dynamically recalculates displayed prices (20% annual discount)',
      'FAQ accordion items expand on click and collapse sibling/previous item',
      'No horizontal overflow at 375px, 768px, and 1280px screen widths',
    ],
    assertions: [
      { id: 'saas_nav_header', description: 'Header navigation is visible with logo and links', action: 'assert_visible', role: 'banner' },
      { id: 'saas_hero_heading', description: 'Primary <h1> hero heading is present and accessible', action: 'assert_visible', role: 'heading', name: 'DevOps Pulse' },
      { id: 'saas_cta_button', description: 'CTA button "Start Free Trial" is clickable', action: 'assert_visible', role: 'button', name: 'Start Free Trial' },
      { id: 'saas_pricing_cards', description: 'Pricing matrix renders three tier cards', action: 'assert_count', selector: '[data-testid="pricing-tier-card"]', count: 3 },
      { id: 'saas_overflow_desktop', description: 'Zero horizontal scroll overflow on desktop viewport (1280px)', action: 'assert_no_horizontal_overflow', viewport: { width: 1280, height: 800 } },
      { id: 'saas_overflow_mobile', description: 'Zero horizontal scroll overflow on mobile viewport (375px)', action: 'assert_no_horizontal_overflow', viewport: { width: 375, height: 667 } },
      { id: 'saas_console_clean', description: 'Zero unhandled client console errors', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'none',
      entities: [],
      survivesReload: false,
    },
    failureConditions: [
      'Horizontal scrollbar detected at 375px viewport',
      'Missing pricing tiers or broken CTA buttons',
      'Uncaught client React hydration exceptions or syntax errors',
    ],
    budgets: {
      maxT0Ms: 3000,
      maxT1Ms: 25000,
      maxT2Ms: 50000,
      maxT3Ms: 70000,
      maxTokens: 20000,
      maxCostUsd: 0.03,
      maxRepairAttempts: 2,
    },
  },
  {
    id: 'bench_02_dev_portfolio',
    category: 'application_generation',
    name: 'DevFolio Pro Developer Portfolio',
    description: 'Clean, modern software engineer portfolio featuring bio, project cards with tech tags, experience timeline, and contact form.',
    prompt: 'Create a personal portfolio website for a Senior Full-Stack Engineer named Alex Rivera. Include Home, Projects, Experience, and Contact sections. Projects must show filterable tags (React, Next.js, Node, Go, AI) and GitHub/Live demo links. The contact form must perform client-side validation (valid email format, non-empty subject, minimum 10 characters message) and show a success confirmation message upon submission.',
    targetRoutes: [
      { path: '/', name: 'Portfolio', description: 'Full portfolio landing and showcase' },
      { path: '/projects', name: 'Projects', description: 'Filterable project gallery' },
    ],
    requiredFeatures: [
      'Hero Bio with Social and Resume Links',
      'Filterable Project Showcase Cards',
      'Experience Career Timeline',
      'Contact Form with Live Validation and Success Feedback',
    ],
    functionalAcceptanceCriteria: [
      'Tag filter pills dynamically show/hide matching project cards',
      'Contact form rejects invalid emails and displays inline error messages',
      'Submitting valid contact details clears the form and shows success confirmation',
      'All external links open securely with rel="noopener noreferrer"',
    ],
    assertions: [
      { id: 'port_heading', description: 'Primary developer title heading is visible', action: 'assert_visible', role: 'heading', name: 'Alex Rivera' },
      { id: 'port_filter_buttons', description: 'Tag filter buttons exist for technology categories', action: 'assert_visible', role: 'button', name: 'Next.js' },
      { id: 'port_contact_form', description: 'Contact form contains name, email, and message inputs', action: 'assert_visible', selector: 'form' },
      { id: 'port_overflow_mobile', description: 'Zero horizontal scroll on mobile viewport', action: 'assert_no_horizontal_overflow', viewport: { width: 375, height: 667 } },
      { id: 'port_console_clean', description: 'Zero unhandled console errors', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'localStorage',
      entities: ['sent_messages'],
      survivesReload: true,
    },
    failureConditions: [
      'Contact form allows empty submission without validation error',
      'Filter buttons do not alter displayed card lists',
    ],
    budgets: {
      maxT0Ms: 3000,
      maxT1Ms: 25000,
      maxT2Ms: 50000,
      maxT3Ms: 70000,
      maxTokens: 20000,
      maxCostUsd: 0.03,
      maxRepairAttempts: 2,
    },
  },
  {
    id: 'bench_03_admin_dashboard',
    category: 'application_generation',
    name: 'FinPulse Admin Analytics Dashboard',
    description: 'Executive SaaS administration dashboard with metrics, revenue time-series charts, tabular transaction ledger, and search filters.',
    prompt: 'Synthesize an executive SaaS admin dashboard named "FinPulse". Provide high-level KPI stat cards (MRR $42,500, Active Subscribers 1,420, Churn 1.8%, ARPU $38) with percentage trends. Include a visual monthly revenue bar/line chart and a data table of customer transactions with search by customer name, filter by status (Completed, Pending, Failed), and pagination or sortable columns. Include a date range selector (Last 7 Days, Last 30 Days, Year to Date).',
    targetRoutes: [
      { path: '/', name: 'Dashboard', description: 'Overview KPI cards and revenue chart' },
      { path: '/transactions', name: 'Transactions', description: 'Searchable transaction ledger' },
      { path: '/customers', name: 'Customers', description: 'Customer directory and status' },
    ],
    requiredFeatures: [
      'Metric KPI Cards with Trend Indicators',
      'Revenue Time-Series Chart Component',
      'Searchable & Filterable Transaction Data Table',
      'Status Filter Dropdown (All, Completed, Pending, Failed)',
      'Date Range Selection Filter',
    ],
    functionalAcceptanceCriteria: [
      'All 4 KPI cards display formatted currency/numbers and positive/negative trend pills',
      'Searching transaction table filters results instantaneously without full page reload',
      'Selecting a status pill filters rows to match selected state',
      'Data table shows "No transactions found" state when filter yields zero matches',
    ],
    assertions: [
      { id: 'dash_kpi_mrr', description: 'MRR KPI card is visible with formatted metric', action: 'assert_visible', text: 'MRR' },
      { id: 'dash_table', description: 'Transactions table is populated with rows', action: 'assert_visible', role: 'table' },
      { id: 'dash_search_input', description: 'Customer search input field is operable', action: 'assert_visible', role: 'searchbox' },
      { id: 'dash_console_clean', description: 'Zero unhandled console errors', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'localStorage',
      entities: ['transactions', 'kpis'],
      survivesReload: true,
    },
    failureConditions: [
      'Transaction filter throws null reference error',
      'Chart rendering causes canvas or SVG layout crash',
    ],
    budgets: {
      maxT0Ms: 3500,
      maxT1Ms: 30000,
      maxT2Ms: 55000,
      maxT3Ms: 80000,
      maxTokens: 25000,
      maxCostUsd: 0.04,
      maxRepairAttempts: 2,
    },
  },
  {
    id: 'bench_04_task_management',
    category: 'application_generation',
    name: 'TaskFlow Kanban Management App',
    description: 'Full-featured productivity application with task creation, editing, status transitions across Kanban columns, deletion, and persistent browser storage.',
    prompt: 'Build an interactive Kanban board task management app named "TaskFlow". Users can create tasks with title, description, priority (Low, Medium, High), and due date. Display tasks in 3 distinct columns: "To Do", "In Progress", and "Done". Support moving tasks between columns (via button click or drag). Users can edit task details in a modal or inline, delete tasks with confirmation, and filter by priority. Tasks must be persisted in localStorage so refreshing the page preserves all created and modified tasks.',
    targetRoutes: [
      { path: '/', name: 'Board', description: 'Kanban board view with columns' },
      { path: '/list', name: 'List', description: 'Tabular list view of all tasks' },
    ],
    requiredFeatures: [
      'Create Task Form with Title, Priority, and Description',
      'Kanban Column Board (To Do, In Progress, Done)',
      'Status Transition Controls (Move forward / backward)',
      'Edit Task Modal or Inline Form',
      'Delete Task Action',
      'Priority Badge Filtering',
      'LocalStorage Persistence across Browser Reloads',
    ],
    functionalAcceptanceCriteria: [
      'Submitting create form adds task card to "To Do" column and clears input',
      'Moving a task to "In Progress" updates column count and card position',
      'Editing a task title updates the card title across both board and list views',
      'Deleting a task removes it permanently from DOM and storage',
      'Reloading the browser page retains all user-created tasks in their exact columns',
    ],
    assertions: [
      { id: 'task_col_todo', description: '"To Do" column is visible', action: 'assert_visible', text: 'To Do' },
      { id: 'task_col_progress', description: '"In Progress" column is visible', action: 'assert_visible', text: 'In Progress' },
      { id: 'task_col_done', description: '"Done" column is visible', action: 'assert_visible', text: 'Done' },
      { id: 'task_add_button', description: 'Add task button or trigger is accessible', action: 'assert_visible', role: 'button', name: 'Add Task' },
      { id: 'task_create_submit', description: 'Create task form accepts title and submits', action: 'fill_form', selector: 'form', value: 'Verify E2E Benchmark Pipeline' },
      { id: 'task_persisted_reload', description: 'Created task survives browser reload', action: 'assert_persisted', text: 'Verify E2E Benchmark Pipeline' },
      { id: 'task_console_clean', description: 'Zero client console errors', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'localStorage',
      entities: ['tasks', 'columns'],
      survivesReload: true,
    },
    failureConditions: [
      'Created task vanishes after browser reload',
      'Column status update corrupts task data structure',
      'Uncaught TypeError on delete or edit operations',
    ],
    budgets: {
      maxT0Ms: 3000,
      maxT1Ms: 25000,
      maxT2Ms: 50000,
      maxT3Ms: 75000,
      maxTokens: 22000,
      maxCostUsd: 0.035,
      maxRepairAttempts: 2,
    },
  },
  {
    id: 'bench_05_expense_tracker',
    category: 'application_generation',
    name: 'BudgetPilot Expense Tracker',
    description: 'Personal finance application with income/expense logging, category breakdown, running balance calculator, and CSV export.',
    prompt: 'Develop a personal budget and expense tracking application named "BudgetPilot". Features: Log transactions (Title, Amount, Type [Income/Expense], Category [Housing, Food, Transport, Utilities, Entertainment, Salary], Date). Calculate Total Income, Total Expenses, and Net Balance in real time. Show categorical expense distribution percentages. Provide an "Export to CSV" button that generates a downloadable CSV file. Persist all entries in localStorage.',
    targetRoutes: [
      { path: '/', name: 'Overview', description: 'Summary cards, entry form, and recent log' },
      { path: '/analytics', name: 'Analytics', description: 'Category breakdown and spending charts' },
    ],
    requiredFeatures: [
      'Transaction Entry Form with Number Validation',
      'Real-time Balance / Income / Expense KPI Cards',
      'Categorical Spending Breakdown with Progress Bars',
      'Transaction History Table with Delete Option',
      'Client-side CSV Export Utility',
      'Zero-loss LocalStorage Persistence',
    ],
    functionalAcceptanceCriteria: [
      'Net balance equals Total Income minus Total Expenses exactly',
      'Negative amounts or non-numeric inputs are rejected by the form',
      'Adding an expense increments the category total and decrements net balance',
      'Clicking Export CSV triggers file download with valid headers and rows',
      'Browser reload preserves transaction log and updated balance',
    ],
    assertions: [
      { id: 'budget_balance_card', description: 'Net Balance metric card is visible', action: 'assert_visible', text: 'Net Balance' },
      { id: 'budget_amount_input', description: 'Amount numeric input field exists', action: 'assert_visible', selector: 'input[type="number"], input[name="amount"]' },
      { id: 'budget_add_tx', description: 'Submit transaction button is clickable', action: 'assert_visible', role: 'button', name: 'Add Transaction' },
      { id: 'budget_export_csv', description: 'Export CSV button exists', action: 'assert_visible', role: 'button', name: 'Export' },
      { id: 'budget_console_clean', description: 'Zero unhandled console errors', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'localStorage',
      entities: ['transactions', 'budgetCategories'],
      survivesReload: true,
    },
    failureConditions: [
      'Floating-point arithmetic calculation errors in Net Balance',
      'CSV export fails to generate valid comma-separated text',
    ],
    budgets: {
      maxT0Ms: 3000,
      maxT1Ms: 25000,
      maxT2Ms: 50000,
      maxT3Ms: 75000,
      maxTokens: 22000,
      maxCostUsd: 0.035,
      maxRepairAttempts: 2,
    },
  },
  {
    id: 'bench_06_auth_application',
    category: 'application_generation',
    name: 'VaultAuth Membership Application',
    description: 'Authentication-flow application with login, registration, password validation, protected dashboard route, and logout state transition.',
    prompt: 'Build a secure client-side membership portal named "VaultAuth". Pages: Public Home, Sign In (/login), Sign Up (/register), and Protected Dashboard (/dashboard). Sign Up requires Name, Email, Password (min 8 chars, 1 number, 1 special char), and Password Confirmation. On successful login, store user session in localStorage and redirect to /dashboard. If an unauthenticated user navigates directly to /dashboard, redirect them to /login with a notice. Include a Logout button that terminates the session.',
    targetRoutes: [
      { path: '/', name: 'Home', description: 'Public welcome landing' },
      { path: '/login', name: 'Sign In', description: 'User login form' },
      { path: '/register', name: 'Sign Up', description: 'Account registration' },
      { path: '/dashboard', name: 'Dashboard', description: 'Protected member dashboard' },
    ],
    requiredFeatures: [
      'Registration Form with Password Strength Validation',
      'Sign In Form with Credentials Checking',
      'Protected Route Guard for /dashboard',
      'Session State Management in Browser Storage',
      'Logout Action with Redirect to Home',
    ],
    functionalAcceptanceCriteria: [
      'Registration rejects passwords shorter than 8 characters or mismatched confirmation',
      'Valid registration creates user account in localStorage and logs user in',
      'Unauthenticated direct navigation to /dashboard redirects to /login',
      'Clicking Logout clears active user session and redirects to /',
    ],
    assertions: [
      { id: 'auth_nav_login', description: 'Login navigation link is accessible', action: 'assert_visible', role: 'link', name: 'Sign In' },
      { id: 'auth_login_form', description: 'Login form contains email and password fields', action: 'assert_visible', selector: 'form' },
      { id: 'auth_console_clean', description: 'Zero unhandled console errors', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'localStorage',
      entities: ['users', 'session'],
      survivesReload: true,
    },
    failureConditions: [
      'Unauthenticated user can access /dashboard content without login',
      'Password confirmation mismatch is submitted without error',
    ],
    budgets: {
      maxT0Ms: 3000,
      maxT1Ms: 25000,
      maxT2Ms: 50000,
      maxT3Ms: 75000,
      maxTokens: 24000,
      maxCostUsd: 0.04,
      maxRepairAttempts: 2,
    },
  },
  {
    id: 'bench_07_relational_app',
    category: 'application_generation',
    name: 'CollabSpace Relational Workspace',
    description: 'Relational project collaboration app with 1:N and N:M data models (Workspaces ➔ Projects ➔ Tasks ➔ Comments) and referential integrity.',
    prompt: 'Construct a team workspace app named "CollabSpace" demonstrating relational data handling. Entities: Workspaces contain multiple Projects; Projects contain multiple Tasks; Tasks have multiple Comments and an assigned Team Member. Users can select an active Workspace, drill down into Projects, create tasks under that project, and post comments on a task. Deleting a project cascade-deletes its associated tasks and comments. State must be persisted in localStorage with intact foreign-key references.',
    targetRoutes: [
      { path: '/', name: 'Workspaces', description: 'Workspace list and selector' },
      { path: '/projects', name: 'Projects', description: 'Projects inside active workspace' },
      { path: '/tasks', name: 'Tasks', description: 'Tasks and comments detail view' },
    ],
    requiredFeatures: [
      'Workspace Selector and Creator',
      'Scoped Project Listing by Workspace ID',
      'Task List Scoped by Project ID',
      'Task Comments Thread Component',
      'Cascade Deletion of Child Entities',
      'Referential Integrity in Browser Storage',
    ],
    functionalAcceptanceCriteria: [
      'Switching workspace filters displayed projects to only those belonging to the workspace',
      'Adding a task attaches the active project ID as foreign key',
      'Deleting a project removes all child tasks and comments from storage',
      'Foreign-key lookups never throw undefined/null reference exceptions on missing children',
    ],
    assertions: [
      { id: 'rel_workspace_picker', description: 'Workspace selector exists', action: 'assert_visible', role: 'combobox' },
      { id: 'rel_project_cards', description: 'Project list renders scoped items', action: 'assert_visible', selector: '[data-testid="project-card"]' },
      { id: 'rel_console_clean', description: 'Zero unhandled console errors', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'localStorage',
      entities: ['workspaces', 'projects', 'tasks', 'comments'],
      survivesReload: true,
    },
    failureConditions: [
      'Orphaned tasks remain visible after parent project is deleted',
      'Foreign key mismatch renders blank screen or unhandled error',
    ],
    budgets: {
      maxT0Ms: 3500,
      maxT1Ms: 30000,
      maxT2Ms: 55000,
      maxT3Ms: 85000,
      maxTokens: 25000,
      maxCostUsd: 0.045,
      maxRepairAttempts: 2,
    },
  },

  // =========================================================================
  // CATEGORY 2: FOLLOW-UP MODIFICATION & REGRESSION (Scenario 8)
  // =========================================================================
  {
    id: 'bench_08_followup_modification',
    category: 'modification_and_regression',
    name: 'TaskFlow + Dark Mode & Priority Tagging',
    description: 'Iterative natural-language code modification on an existing codebase, verifying new capability addition without regressing existing CRUD.',
    prompt: 'Build the baseline TaskFlow Kanban app.',
    followupPrompt: 'Modify the existing TaskFlow app: Add a dark mode toggle button in the header that switches the theme between light and dark mode and stores the preference. Also add a search input above the board that filters tasks in real time across all columns by keyword. Do not break or remove existing task creation, column dragging, or localStorage persistence.',
    targetRoutes: [
      { path: '/', name: 'Board', description: 'Kanban board view' },
    ],
    requiredFeatures: [
      'Dark / Light Mode Toggle Button in Header',
      'Theme Preference Persistence in LocalStorage',
      'Real-time Task Keyword Search Input',
      'Preservation of Existing Create, Edit, Move, and Delete Functions',
    ],
    functionalAcceptanceCriteria: [
      'Existing tasks created prior to modification remain accessible and intact',
      'Clicking Dark Mode toggle toggles .dark class on html/root and updates theme button',
      'Searching filters cards across To Do, In Progress, and Done simultaneously',
      'Clearing search query restores all tasks to view',
      'Zero regressions in task creation or deletion',
    ],
    assertions: [
      { id: 'mod_theme_toggle', description: 'Dark mode theme toggle button exists in header', action: 'assert_visible', role: 'button', name: 'Dark Mode' },
      { id: 'mod_search_input', description: 'Board search input field exists', action: 'assert_visible', role: 'searchbox' },
      { id: 'mod_add_task_intact', description: 'Add Task button remains functional', action: 'assert_visible', role: 'button', name: 'Add Task' },
      { id: 'mod_console_clean', description: 'Zero unhandled console errors', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'localStorage',
      entities: ['tasks', 'themePreference'],
      survivesReload: true,
    },
    failureConditions: [
      'Adding dark mode breaks task creation or column rendering',
      'Modification replaces entire codebase with empty or non-functioning template',
    ],
    budgets: {
      maxT0Ms: 3000,
      maxT1Ms: 25000,
      maxT2Ms: 50000,
      maxT3Ms: 75000,
      maxTokens: 20000,
      maxCostUsd: 0.035,
      maxRepairAttempts: 2,
    },
  },

  // =========================================================================
  // CATEGORY 3: ERROR RECOVERY (Scenario 9)
  // =========================================================================
  {
    id: 'bench_09_error_recovery',
    category: 'error_recovery',
    name: 'Diagnostic Syntax & Manifest Repair',
    description: 'Automated detection, bounded repair loop convergence, and recovery from injected syntax and schema errors.',
    prompt: 'Generate an analytics dashboard with charts and table.',
    targetRoutes: [
      { path: '/', name: 'Dashboard', description: 'Dashboard view' },
    ],
    requiredFeatures: [
      'Error Detection Diagnostic Logging',
      'Automated Bounded Repair Loop (1 - 3 attempts)',
      'Clean Convergence to Passing Build & Preview',
    ],
    functionalAcceptanceCriteria: [
      'Orchestrator detects error during validation phase without uncaught crash',
      'Bounded repair loop isolates failing file and applies targeted fix',
      'Second validation check passes and transitions project to preview_ready',
      'Diagnostic event log records error details and repair attempt number',
    ],
    assertions: [
      { id: 'recov_status_ready', description: 'Project achieves preview_ready after repair loop', action: 'assert_visible', selector: '[data-testid="dashboard-root"]' },
      { id: 'recov_console_clean', description: 'Zero remaining fatal console errors after repair', action: 'assert_no_console_errors' },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'validating', 'repairing', 'validating', 'starting', 'preview_ready', 'completed'],
    persistenceRequirements: {
      storageType: 'none',
      entities: [],
      survivesReload: false,
    },
    failureConditions: [
      'Repair loop enters infinite loop exceeding MAX_ATTEMPTS (3)',
      'Orchestrator crashes and leaves run in stuck generating state',
    ],
    budgets: {
      maxT0Ms: 3000,
      maxT1Ms: 30000,
      maxT2Ms: 65000,
      maxT3Ms: 90000,
      maxTokens: 25000,
      maxCostUsd: 0.045,
      maxRepairAttempts: 3,
    },
  },

  // =========================================================================
  // CATEGORY 4: CANCELLATION & LIFECYCLE INTEGRITY (Scenario 10)
  // =========================================================================
  {
    id: 'bench_10_cancellation_integrity',
    category: 'cancellation_and_lifecycle',
    name: 'In-Flight Cancellation & Reconnection Integrity',
    description: 'Proves explicit user cancellation halts in-flight generation, protects version integrity, and allows clean follow-up generation.',
    prompt: 'Build a comprehensive multi-page ERP system with 20 pages.',
    targetRoutes: [
      { path: '/', name: 'Home', description: 'Home' },
    ],
    requiredFeatures: [
      'Immediate In-flight Request Abort',
      'Durable Status Transition to "cancelled"',
      'Zero Version Publication on Acknowledged Cancel',
      'Clean State for Immediate Subsequent Generation Run',
    ],
    functionalAcceptanceCriteria: [
      'POST /cancel marks database record status as cancelled within 500ms',
      'In-flight AI request is terminated without billable output publication',
      'db.publishVersionIfActive rejects publication and commits 0 versions',
      'A subsequent generate request on the same project succeeds normally',
    ],
    assertions: [
      { id: 'cancel_zero_versions', description: 'Zero versions committed for cancelled run', action: 'assert_count', selector: '[data-testid="version-pill"]', count: 0 },
    ],
    expectedStateTransitions: ['queued', 'planning', 'generating', 'cancelled'],
    persistenceRequirements: {
      storageType: 'none',
      entities: [],
      survivesReload: false,
    },
    failureConditions: [
      'Version is published after cancel endpoint returned 200 OK',
      'Subsequent generation run blocked due to zombie lock',
    ],
    budgets: {
      maxT0Ms: 2000,
      maxT1Ms: 15000,
      maxT2Ms: 30000,
      maxT3Ms: 35000,
      maxTokens: 5000,
      maxCostUsd: 0.01,
      maxRepairAttempts: 0,
    },
  },
];
