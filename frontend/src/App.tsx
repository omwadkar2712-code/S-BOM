import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppStateProvider } from './context/AppStateContext';
import { Layout } from './components/layout/Layout';

import { Dashboard } from './pages/dashboard';
import { SecurityScans } from './pages/scans';
import { SoftwareInventory, AddInventoryComponent, SBOMArtifacts } from './pages/inventory';
import { ProjectsMicroservices } from './pages/projects';
import { Vulnerabilities, Remediation, VulnerabilityDetail } from './pages/vulnerabilities';
import { Compliance, Policies } from './pages/compliance';
import { ExportCenter } from './pages/export';
import { SupplyChain } from './pages/supply-chain';
import { Monitoring, Integrations } from './pages/monitoring';
import { Profile, Users, Settings } from './pages/settings';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/security-scans" element={<SecurityScans />} />
              <Route path="/security-scans/:tab" element={<SecurityScans />} />

              <Route path="/software-inventory" element={<SoftwareInventory />} />
              <Route path="/software-inventory/components" element={<SoftwareInventory />} />
              <Route path="/software-inventory/add" element={<AddInventoryComponent />} />
              <Route path="/software-inventory/projects" element={<ProjectsMicroservices />} />
              <Route path="/software-inventory/artifacts" element={<SBOMArtifacts />} />

              <Route path="/vulnerabilities" element={<Vulnerabilities />} />
              <Route path="/vulnerabilities/:cveId" element={<VulnerabilityDetail />} />
              <Route path="/remediation" element={<Remediation />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/export-center" element={<ExportCenter />} />
              <Route path="/policies" element={<Policies />} />
              <Route path="/supply-chain" element={<SupplyChain />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/users" element={<Users />} />
              <Route path="/settings" element={<Settings />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AppStateProvider>
    </ThemeProvider>
  );
};

export default App;
