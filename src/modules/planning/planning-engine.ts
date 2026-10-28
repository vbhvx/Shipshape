import {
  ProjectSpecification,
  ApplicationPlan,
  RouteSpecification,
  FeatureSpecification,
  DataEntitySpecification,
  DesignSpecification,
  IntegrationRequirement,
} from '@/types';
import { inferDomain } from './domain-catalog';

/**
 * Creates a structured ProjectSpecification and editable ApplicationPlan from natural language requirements.
 */
export async function createPlanFromPrompt(
  projectId: string,
  projectName: string,
  prompt: string,
  existingSpec?: ProjectSpecification | null
): Promise<ApplicationPlan> {
  const domain = inferDomain(prompt, projectName);

  // Interpret Routes from inferred domain
  const routes: RouteSpecification[] = domain.routes;

  // Interpret Features from inferred domain
  const features: FeatureSpecification[] = domain.features;

  // Interpret Data Entities
  const dataEntities: DataEntitySpecification[] = [
    {
      name: domain.entityName,
      description: domain.entityDescription,
      fields: domain.fields,
    },
    ...(domain.additionalEntities || []),
  ];

  // Design Specification
  const designSystem: DesignSpecification = {
    theme: 'dark',
    primaryColor: domain.accentHex,
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
