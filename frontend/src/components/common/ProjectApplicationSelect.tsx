import React, { useEffect, useRef, useState } from 'react';
import { ApiError, createCatalogApplication, createCatalogProject, type CatalogRecord } from '../../api/client';
import { SearchableSelect } from './SearchableSelect';
import { useCatalogApplications, useCatalogProjects } from '../../hooks/useCatalogOptions';

export interface ProjectApplicationValue {
  project: CatalogRecord | null;
  application: CatalogRecord | null;
}

interface ProjectApplicationSelectProps {
  value: ProjectApplicationValue;
  onChange: (next: ProjectApplicationValue) => void;
  required?: boolean;
  variant?: 'scan' | 'form';
  projectLabel?: React.ReactNode;
  applicationLabel?: React.ReactNode;
  projectHint?: string;
  applicationHint?: string;
  className?: string;
}

export const ProjectApplicationSelect: React.FC<ProjectApplicationSelectProps> = ({
  value,
  onChange,
  required = true,
  variant = 'form',
  projectLabel = 'Project Name',
  applicationLabel = 'Application / Service',
  projectHint,
  applicationHint,
  className,
}) => {
  const projects = useCatalogProjects();
  const applications = useCatalogApplications(value.project?.id || null);
  const lastProject = useRef(value.project?.id || '');
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingApplication, setCreatingApplication] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [applicationError, setApplicationError] = useState<string | null>(null);

  useEffect(() => {
    const nextId = value.project?.id || '';
    if (lastProject.current === nextId) return;
    lastProject.current = nextId;
    if (value.application) onChange({ project: value.project, application: null });
  }, [onChange, value.application, value.project]);

  const applicationDisabled = !value.project;
  const applicationPlaceholder = applicationDisabled
    ? 'Select a Project First'
    : applications.loading
      ? 'Loading applications…'
      : 'Select, search, or add an application';
  const applicationEmpty = applications.error
    ? applications.error
    : 'No applications yet. Type a name to add one.';

  const addProject = async (name: string) => {
    setCreatingProject(true);
    setProjectError(null);
    try {
      const created = await createCatalogProject({ name });
      projects.reload();
      onChange({ project: { id: created.id, name: created.name }, application: null });
    } catch (error) {
      setProjectError(error instanceof ApiError ? error.message : 'Could not add project.');
      throw error;
    } finally {
      setCreatingProject(false);
    }
  };

  const addApplication = async (name: string) => {
    if (!value.project?.id) return;
    setCreatingApplication(true);
    setApplicationError(null);
    try {
      const created = await createCatalogApplication(value.project.id, name);
      applications.reload();
      onChange({
        project: value.project,
        application: { id: created.id, name: created.name, project_id: created.project_id },
      });
    } catch (error) {
      setApplicationError(error instanceof ApiError ? error.message : 'Could not add application/service.');
      throw error;
    } finally {
      setCreatingApplication(false);
    }
  };

  return (
    <>
      <div className={className}>
        <SearchableSelect
          variant={variant}
          label={projectLabel}
          required={required}
          value={value.project}
          options={projects.items}
          loading={projects.loading}
          creating={creatingProject}
          allowCreate
          error={projectError || projects.error}
          emptyMessage={projects.error || 'No projects yet. Type a name to add one.'}
          placeholder="Select, search, or add a project"
          hint={projectHint}
          hasMore={projects.hasMore}
          onLoadMore={projects.loadMore}
          onQueryChange={projects.setQuery}
          onOpen={projects.reload}
          onCreate={addProject}
          onChange={(project) => {
            setProjectError(null);
            onChange({ project, application: null });
          }}
        />
      </div>
      <div className={className}>
        <SearchableSelect
          variant={variant}
          label={applicationLabel}
          required={required}
          value={value.application}
          options={applications.items}
          loading={applications.loading}
          creating={creatingApplication}
          allowCreate
          disabled={applicationDisabled}
          error={applicationError || applications.error}
          emptyMessage={applicationEmpty}
          placeholder={applicationPlaceholder}
          disabledPlaceholder={applicationPlaceholder}
          hint={applicationHint}
          hasMore={applications.hasMore}
          onLoadMore={applications.loadMore}
          onQueryChange={applications.setQuery}
          onCreate={addApplication}
          onChange={(application) => {
            setApplicationError(null);
            onChange({ project: value.project, application });
          }}
        />
      </div>
    </>
  );
};
