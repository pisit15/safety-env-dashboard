/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      // Training (already migrated previously)
      { source: '/training', destination: '/projects/training', permanent: false },
      { source: '/company/:id/training', destination: '/projects/training/:id', permanent: false },
      // Employees
      { source: '/employees', destination: '/projects/employees', permanent: false },
      { source: '/company/:id/employees', destination: '/projects/employees/:id', permanent: false },
      // SHE Workforce moved to tools.eashe.org (external)
      { source: '/she-workforce', destination: 'https://tools.eashe.org/she-workforce', permanent: false, basePath: false },
      { source: '/company/:id/she-workforce', destination: 'https://tools.eashe.org/she-workforce', permanent: false, basePath: false },
      { source: '/admin/she-workforce', destination: 'https://tools.eashe.org/she-workforce', permanent: false, basePath: false },
      { source: '/projects/employees/she-workforce', destination: 'https://tools.eashe.org/she-workforce', permanent: false, basePath: false },
      { source: '/projects/employees/she-workforce/:id', destination: 'https://tools.eashe.org/she-workforce', permanent: false, basePath: false },
      // Risk Assessment
      { source: '/company/:id/risk', destination: '/projects/risk/:id', permanent: false },
      { source: '/company/:id/risk/guide', destination: '/projects/risk/:id/guide', permanent: false },
      { source: '/company/:id/risk/:taskId', destination: '/projects/risk/:id/:taskId', permanent: false },
      // Near Miss
      { source: '/admin/nearmiss', destination: '/projects/nearmiss', permanent: false },
      { source: '/company/:id/nearmiss', destination: '/projects/nearmiss/:id', permanent: false },
      // Special Projects
      { source: '/company/:id/projects', destination: '/projects/special/:id', permanent: false },
      { source: '/company/:id/projects/:pid', destination: '/projects/special/:id/:pid', permanent: false },
      // Incidents & Manhours
      { source: '/incidents', destination: '/projects/incidents', permanent: false },
      { source: '/company/:id/incidents', destination: '/projects/incidents/:id', permanent: false },
      { source: '/company/:id/manhours', destination: '/projects/incidents/:id/manhours', permanent: false },
      // Action Plan
      { source: '/action-plan', destination: '/projects/action-plan', permanent: false },
      { source: '/company/:id/action-plan', destination: '/projects/action-plan/:id', permanent: false },
      // Admin legacy
      { source: '/admin', destination: '/projects', permanent: false },
    ];
  },
};

export default nextConfig;
