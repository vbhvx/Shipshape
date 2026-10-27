import {
  ProjectSpecification,
  ApplicationPlan,
  RouteSpecification,
  FeatureSpecification,
  DataEntitySpecification,
  DesignSpecification,
  IntegrationRequirement,
} from '@/types';

/**
 * Creates a structured ProjectSpecification and editable ApplicationPlan from natural language requirements.
 */
export async function createPlanFromPrompt(
  projectId: string,
  projectName: string,
  prompt: string,
  existingSpec?: ProjectSpecification | null
): Promise<ApplicationPlan> {
  const lower = prompt.toLowerCase();

  // Detect category and domains from prompt
  const isKanban = lower.includes('kanban') || lower.includes('task') || lower.includes('todo') || lower.includes('board') || lower.includes('sprint');
  const isEcommerce = lower.includes('store') || lower.includes('shop') || lower.includes('cart') || lower.includes('product') || lower.includes('commerce') || lower.includes('fragrance');
  const isCrm = lower.includes('crm') || lower.includes('contact') || lower.includes('lead') || lower.includes('customer') || lower.includes('pipeline');
  const isAnalytics = lower.includes('analytic') || lower.includes('dashboard') || lower.includes('metric') || lower.includes('chart') || lower.includes('kpi');
  const isWindOrWeather = lower.includes('wind') || lower.includes('weather') || lower.includes('forecast') || lower.includes('energy');

  // Interpret Routes
  const routes: RouteSpecification[] = [
    {
      path: '/',
      name: 'Home & Overview',
      description: 'Main dashboard view, quick actions, metric highlights, and primary workflow entry point',
      isProtected: false,
    },
    {
      path: '/explore',
      name: isEcommerce ? 'Product Catalog' : isKanban ? 'Task Board' : isCrm ? 'Contacts & Deals' : isWindOrWeather ? 'Forecast Intelligence' : 'Data Explorer',
      description: 'Interactive management table and search/filter interface with real-time operations',
      isProtected: false,
    },
    {
      path: '/analytics',
      name: 'Analytics & Insights',
      description: 'Visual performance metrics, breakdowns, charts, and summary reports',
      isProtected: false,
    },
    {
      path: '/settings',
      name: 'Settings & Config',
      description: 'Application preferences, notification controls, data export, and profile settings',
      isProtected: false,
    },
  ];

  // Interpret Features
  const features: FeatureSpecification[] = [
    {
      id: 'feat_crud',
      name: isKanban ? 'Drag-and-Drop Task Management' : isEcommerce ? 'Interactive Product Catalog & Cart' : isCrm ? 'Contact Lifecycle & Deal Pipeline' : 'Interactive Record Management',
      description: 'Create, update, search, filter, and delete items with immediate state persistence and validation',
      category: 'core',
      status: 'planned',
    },
    {
      id: 'feat_search_filter',
      name: 'Real-time Search & Multi-criteria Filtering',
      description: 'Instant client-side fuzzy search, category filtering, and status sorting',
      category: 'ui',
      status: 'planned',
    },
    {
      id: 'feat_analytics',
      name: 'Dynamic KPI Dashboard & Visual Metrics',
      description: 'Calculated metrics, distribution bars, progress tracking, and historical trends',
      category: 'ui',
      status: 'planned',
    },
    {
      id: 'feat_persistence',
      name: 'Client-Safe Local Storage & API Sync',
      description: 'Zero-loss state survival across browser refreshes with mock API boundary',
      category: 'data',
      status: 'planned',
    },
    {
      id: 'feat_export',
      name: 'CSV & JSON Data Export',
      description: 'One-click export of data tables and records to CSV format',
      category: 'core',
      status: 'planned',
    },
  ];

  // Interpret Data Entities
  let dataEntities: DataEntitySpecification[] = [];
  if (isKanban) {
    dataEntities = [
      {
        name: 'TaskItem',
        description: 'Represents a kanban card or task item in the project workflow',
        fields: [
          { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
          { name: 'title', type: 'string', required: true, description: 'Task title' },
          { name: 'description', type: 'string', required: false, description: 'Detailed markdown notes' },
          { name: 'status', type: 'string', required: true, description: 'todo | in_progress | review | done' },
          { name: 'priority', type: 'string', required: true, description: 'low | medium | high | urgent' },
          { name: 'assignee', type: 'string', required: false, description: 'User name or email' },
          { name: 'dueDate', type: 'string', required: false, description: 'ISO date string' },
          { name: 'tags', type: 'string[]', required: false, description: 'Array of tag labels' },
        ],
      },
    ];
  } else if (isEcommerce) {
    dataEntities = [
      {
        name: 'Product',
        description: 'Represents a catalog product with pricing, inventory, and categories',
        fields: [
          { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
          { name: 'name', type: 'string', required: true, description: 'Product title' },
          { name: 'price', type: 'number', required: true, description: 'Unit price in USD' },
          { name: 'category', type: 'string', required: true, description: 'Product department' },
          { name: 'rating', type: 'number', required: true, description: 'Star rating 1-5' },
          { name: 'stock', type: 'number', required: true, description: 'Available inventory units' },
          { name: 'image', type: 'string', required: true, description: 'Photo URL' },
        ],
      },
      {
        name: 'CartItem',
        description: 'Customer cart item with quantity and line-item total',
        fields: [
          { name: 'productId', type: 'string', required: true, description: 'Referenced product' },
          { name: 'quantity', type: 'number', required: true, description: 'Quantity selected' },
        ],
      },
    ];
  } else {
    dataEntities = [
      {
        name: 'RecordItem',
        description: 'Primary entity representing tracked items or events',
        fields: [
          { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
          { name: 'title', type: 'string', required: true, description: 'Primary label' },
          { name: 'category', type: 'string', required: true, description: 'Classification tag' },
          { name: 'status', type: 'string', required: true, description: 'Current state' },
          { name: 'value', type: 'number', required: true, description: 'Primary quantitative metric' },
          { name: 'updatedAt', type: 'string', required: true, description: 'Last modified ISO timestamp' },
        ],
      },
    ];
  }

  // Design Specification
  const designSystem: DesignSpecification = {
    theme: 'dark',
    primaryColor: '#6366f1', // Indigo
    style: 'modern-minimal',
    typography: 'Inter, system-ui, sans-serif',
  };

  // Integrations
  const integrations: IntegrationRequirement[] = [
    {
      name: 'Local Persistence Engine',
      type: 'storage',
      description: 'Browser localStorage synchronization with fallback in-memory state',
      isConfigured: true,
    },
    {
      name: 'Next.js App Router API',
      type: 'backend',
      description: 'Serverless route handlers for health checks and data operations',
      isConfigured: true,
    },
  ];

  const specification: ProjectSpecification = {
    id: `spec_${Date.now()}`,
    projectId,
    name: projectName,
    description: prompt.trim(),
    targetUsers: ['Product Builders', 'Operations Teams', 'Developers'],
    routes,
    features,
    dataEntities,
    integrations,
    designSystem,
    technicalConstraints: [
      'Next.js 14+ App Router with TypeScript',
      'Tailwind CSS for responsive layout',
      'Safe client-side hydration without SSR mismatch',
      'Zero external database setup required for instant execution',
    ],
    acceptanceCriteria: [
      'All navigation links and pages render without console runtime errors',
      'Data items can be created, updated, searched, and deleted interactively',
      'Dashboard metrics accurately reflect the current data state',
      'Data exports cleanly to downloadable CSV',
      'Responsive design works seamlessly on desktop, tablet, and mobile',
    ],
    versionNumber: (existingSpec?.versionNumber || 0) + 1,
    schemaVersion: '1.0.0',
    createdAt: new Date().toISOString(),
  };

  const plan: ApplicationPlan = {
    projectId,
    specification,
    routes,
    majorComponents: [
      {
        name: 'HeaderNav',
        file: 'src/components/HeaderNav.tsx',
        responsibility: 'Top navigation bar with active route highlight, search trigger, and theme toggle',
        stateManagement: 'local',
      },
      {
        name: 'DashboardView',
        file: 'src/components/DashboardView.tsx',
        responsibility: 'High-level KPI stats cards, status breakdowns, and recent activity',
        stateManagement: 'context',
      },
      {
        name: 'DataManagementTable',
        file: 'src/components/DataManagementTable.tsx',
        responsibility: 'Full CRUD table with modal editor, search, filter, and sorting',
        stateManagement: 'context',
      },
      {
        name: 'MetricChart',
        file: 'src/components/MetricChart.tsx',
        responsibility: 'Visual progress indicators and metric distribution bars',
        stateManagement: 'local',
      },
      {
        name: 'ItemModal',
        file: 'src/components/ItemModal.tsx',
        responsibility: 'Accessible form dialog for creating and updating records with input validation',
        stateManagement: 'local',
      },
    ],
    dataModel: {
      entities: dataEntities,
      storageStrategy: 'localStorage',
      notes: 'State is persisted to browser storage with initial curated seed data and fallback',
    },
    userInteractions: [
      'Viewing KPI metrics and overall status on the home dashboard',
      'Filtering data records by category, status, and search query',
      'Adding a new record via the interactive modal dialog',
      'Editing or deleting existing records with immediate UI update',
      'Exporting current dataset to a CSV file',
    ],
    requiredServices: ['Persistence Service', 'CSV Generator', 'Notification Toast'],
    dependencies: {
      'lucide-react': '^1.16.0',
    },
    validationSteps: [
      'Validate TypeScript types across all components',
      'Verify Next.js routing and layout structure',
      'Confirm zero runtime exceptions during state mutation',
    ],
    assumptions: [
      'Local storage is suitable for initial single-user MVP deployment',
      'Modern browser environment supporting standard ES2022+ APIs',
    ],
    unresolvedQuestions: [],
    createdAt: new Date().toISOString(),
  };

  return plan;
}
