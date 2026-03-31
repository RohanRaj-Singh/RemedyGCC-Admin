/**
 * Tenant Service
 * Mock data and CRUD operations for tenants
 */

import { Tenant, CreateTenantDto, UpdateTenantDto, ScannerOption, BrandingConfig } from './types';
import { DEFAULT_BRANDING } from '@/types/branding';

let tenants: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'Acme Corporation',
    slug: 'acme-corporation',
    domain: 'acme.remedygcc.com',
    subdomain: 'acme',
    status: 'active',
    branding: {
      logoUrl: '/logos/acme.svg',
      colorScheme: {
        primaryColor: '220 90% 45%',
        secondaryColor: '220 60% 95%',
        backgroundColor: '0 0% 100%',
        textColor: '220 10% 20%',
        accentColor: '140 70% 45%',
      },
      fontFamily: 'Roboto, sans-serif',
    },
    assignedScannerId: 'scanner-1',
    assignedScannerName: 'Employee Satisfaction Survey',
    totalSubmissions: 1250,
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-03-15T10:30:00Z',
  },
  {
    id: 'tenant-2',
    name: 'TechStart Inc',
    slug: 'techstart-inc',
    domain: 'techstart.remedygcc.com',
    subdomain: 'techstart',
    status: 'active',
    branding: {
      logoUrl: '/logos/techstart.svg',
      colorScheme: {
        primaryColor: '280 70% 50%',
        secondaryColor: '280 50% 95%',
        backgroundColor: '0 0% 100%',
        textColor: '280 10% 25%',
        accentColor: '160 65% 45%',
      },
      fontFamily: 'Poppins, sans-serif',
    },
    assignedScannerId: 'scanner-2',
    assignedScannerName: 'Tech Startup Survey',
    totalSubmissions: 480,
    createdAt: '2024-02-01T12:00:00Z',
    updatedAt: '2024-03-10T14:00:00Z',
  },
  {
    id: 'tenant-3',
    name: 'Global Solutions Ltd',
    slug: 'global-solutions',
    domain: 'global.remedygcc.com',
    subdomain: 'global',
    status: 'active',
    branding: DEFAULT_BRANDING,
    assignedScannerId: undefined,
    assignedScannerName: undefined,
    totalSubmissions: 45,
    createdAt: '2024-02-20T09:00:00Z',
    updatedAt: '2024-02-20T09:00:00Z',
  },
  {
    id: 'tenant-4',
    name: 'Finance First',
    slug: 'finance-first',
    domain: 'financefirst.remedygcc.com',
    subdomain: 'financefirst',
    status: 'suspended',
    branding: {
      logoUrl: '/logos/financefirst.svg',
      colorScheme: {
        primaryColor: '145 65% 40%',
        secondaryColor: '145 50% 92%',
        backgroundColor: '0 0% 100%',
        textColor: '145 10% 20%',
        accentColor: '45 90% 55%',
      },
      fontFamily: 'Open Sans, sans-serif',
    },
    assignedScannerId: 'scanner-3',
    assignedScannerName: 'Finance Survey',
    totalSubmissions: 0,
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-05T16:00:00Z',
  },
  {
    id: 'tenant-5',
    name: 'HealthCare Plus',
    slug: 'healthcare-plus',
    domain: 'healthcare.remedygcc.com',
    subdomain: 'healthcare',
    status: 'inactive',
    branding: {
      logoUrl: '/logos/healthcareplus.svg',
      colorScheme: {
        primaryColor: '210 75% 50%',
        secondaryColor: '210 60% 94%',
        backgroundColor: '0 0% 100%',
        textColor: '210 10% 25%',
        accentColor: '340 70% 55%',
      },
      fontFamily: 'Montserrat, sans-serif',
    },
    assignedScannerId: undefined,
    assignedScannerName: undefined,
    totalSubmissions: 890,
    createdAt: '2024-01-15T11:00:00Z',
    updatedAt: '2024-02-28T09:00:00Z',
  },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getAllTenants(): Promise<Tenant[]> {
  await delay(300);
  return [...tenants];
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  await delay(200);
  const tenant = tenants.find(t => t.id === id);
  return tenant || null;
}

export async function isSubdomainAvailable(subdomain: string, excludeId?: string): Promise<boolean> {
  await delay(200);
  const exists = tenants.some(t => 
    t.subdomain.toLowerCase() === subdomain.toLowerCase() && 
    t.id !== excludeId
  );
  return !exists;
}

export async function createTenant(data: CreateTenantDto): Promise<Tenant> {
  await delay(400);
  
  const exists = tenants.some(t => t.subdomain.toLowerCase() === data.subdomain.toLowerCase());
  if (exists) {
    throw new Error(`Subdomain "${data.subdomain}" is already taken`);
  }

  const now = new Date().toISOString();
  const subdomain = data.subdomain.toLowerCase();
  const newTenant: Tenant = {
    id: `tenant-${Date.now()}`,
    name: data.name,
    slug: data.name.toLowerCase().replace(/\s+/g, '-'),
    domain: `${subdomain}.remedygcc.com`,
    subdomain,
    status: data.status || 'active',
    branding: data.branding ? { ...DEFAULT_BRANDING, ...data.branding } : DEFAULT_BRANDING,
    assignedScannerId: undefined,
    assignedScannerName: undefined,
    totalSubmissions: 0,
    createdAt: now,
    updatedAt: now,
  };
  
  tenants.push(newTenant);
  return newTenant;
}

export async function updateTenant(id: string, data: UpdateTenantDto): Promise<Tenant> {
  await delay(400);
  
  const index = tenants.findIndex(t => t.id === id);
  if (index === -1) {
    throw new Error('Tenant not found');
  }

  if (data.subdomain) {
    const exists = tenants.some(t => 
      t.subdomain.toLowerCase() === data.subdomain!.toLowerCase() && 
      t.id !== id
    );
    if (exists) {
      throw new Error(`Subdomain "${data.subdomain}" is already taken`);
    }
  }

  const updatedTenant: Tenant = {
    ...tenants[index],
    name: data.name ?? tenants[index].name,
    subdomain: data.subdomain?.toLowerCase() ?? tenants[index].subdomain,
    status: data.status ?? tenants[index].status,
    branding: data.branding ? { ...DEFAULT_BRANDING, ...data.branding } : tenants[index].branding,
    assignedScannerId: data.assignedScannerId === null ? undefined : (data.assignedScannerId ?? tenants[index].assignedScannerId),
    assignedScannerName: data.assignedScannerId === null ? undefined : (data.assignedScannerId ? tenants[index].assignedScannerName : tenants[index].assignedScannerName),
    updatedAt: new Date().toISOString(),
  };

  tenants[index] = updatedTenant;
  return updatedTenant;
}

export async function updateTenantBranding(id: string, branding: Partial<BrandingConfig>): Promise<Tenant> {
  await delay(400);
  
  const index = tenants.findIndex(t => t.id === id);
  if (index === -1) {
    throw new Error('Tenant not found');
  }

  const updatedTenant: Tenant = {
    ...tenants[index],
    branding: { ...DEFAULT_BRANDING, ...tenants[index].branding, ...branding },
    updatedAt: new Date().toISOString(),
  };

  tenants[index] = updatedTenant;
  return updatedTenant;
}

export async function deleteTenant(id: string): Promise<void> {
  await delay(300);
  
  const index = tenants.findIndex(t => t.id === id);
  if (index === -1) {
    throw new Error('Tenant not found');
  }
  
  tenants.splice(index, 1);
}

export async function getAvailableScanners(): Promise<ScannerOption[]> {
  await delay(300);
  
  const { getScanners } = await import('../scanner/service');
  const scanners = await getScanners();
  
  return scanners
    .filter((s: { status: string }) => s.status === 'published')
    .map((s: { id: string; name: string; description?: string; status: string }) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      status: s.status,
    }));
}

export async function getScannerName(scannerId: string): Promise<string | null> {
  const { getScannerById } = await import('../scanner/service');
  const scanner = await getScannerById(scannerId);
  return scanner?.name || null;
}

export async function getTenantStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  byBranding: Record<string, number>;
}> {
  await delay(200);
  
  return {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    inactive: tenants.filter(t => t.status === 'inactive').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
    byBranding: {
      custom: tenants.filter(t => JSON.stringify(t.branding) !== JSON.stringify(DEFAULT_BRANDING)).length,
      default: tenants.filter(t => JSON.stringify(t.branding) === JSON.stringify(DEFAULT_BRANDING)).length,
    },
  };
}