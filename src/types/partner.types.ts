import mongoose from "mongoose";

export interface IColourTheme {
  key: string;
  value: string;
}

export interface CreatePartnerRequest {
  partnersField: string;
  partnerLogo?: string;
  companyName: string;
  supportEmail: string;
  colourTheme: IColourTheme[];
  sidebarGradient?: string;
  isDefault?: boolean;
  createdBy?: string;
  updatedBy?: string;
}

export interface UpdatePartnerRequest {
  partnersField?: string;
  partnerLogo?: string;
  companyName?: string;
  supportEmail?: string;
  colourTheme?: IColourTheme[];
  sidebarGradient?: string;
  isDefault?: boolean;
  updatedBy?: string;
}

export interface PartnerQueryParams {
  pageNo?: number;
  pageSize?: number;
  filters?: Record<string, any>;
  sort?: Record<string, mongoose.SortOrder>;
}

export interface PartnerStatistics {
  total: number;
  active: number;
  deleted: number;
  totalAssignedTenants: number;
  defaultPartner?: string;
}
