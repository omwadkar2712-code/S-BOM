import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppStateProvider } from './context/AppStateContext';
import { Layout } from './components/layout/Layout';

// Primary Pages
import { Dashboard } from './pages/Dashboard';
import { SecurityScans } from './pages/SecurityScans';
import { SoftwareInventory } from './pages/SoftwareInventory';
import { AddInventoryComponent } from './pages/AddInventoryComponent';
import { ProjectsMicroservices } from './pages/ProjectsMicroservices';
import { SBOMArtifacts } from './pages/SBOMArtifacts';

// Auxiliary Pages
import { Vulnerabilities } from './pages/Vulnerabilities';
import { Remediation } from './pages/Remediation';
import { Compliance } from './pages/Compliance';
import { ExportCenter } from './pages/ExportCenter';
import { Policies } from './pages/Policies';
import { SupplyChain } from './pages/SupplyChain';
import { Monitoring } from './pages/Monitoring';
import { Integrations } from './pages/Integrations';
import { Profile } from './pages/Profile';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';

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
              
              {/* Software Inventory routes */}
              <Route path="/software-inventory" element={<SoftwareInventory />} />
              <Route path="/software-inventory/components" element={<SoftwareInventory />} />
              <Route path="/software-inventory/add" element={<AddInventoryComponent />} />
              <Route path="/software-inventory/projects" element={<ProjectsMicroservices />} />
              <Route path="/software-inventory/artifacts" element={<SBOMArtifacts />} />

              {/* Other workspace and system routes */}
              <Route path="/vulnerabilities" element={<Vulnerabilities />} />
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
