import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';


const FINANCE_ROLES = new Set(['finance', 'finance_manager', 'finance_member']);
const DEFAULT_SETTINGS = {
  default_interest_rate: {
    value: '10',
    description: 'Default interest rate percentage',
  },
  default_loan_tenure_months: {
    value: '3',
    description: 'Default loan tenure in months',
  },
  penalty_rate_annual: {
    value: '80',
    description: 'Annual penalty rate percentage',
  },
  cash_in_bank: {
    value: '0',
    description: 'Current cash available in bank',
  },
};


const isFinanceRole = (role) => FINANCE_ROLES.has(role);


const updateSettingRows = async ({ key, value, now, financeCompanyId, onlyGlobal }) => {
  let query = supabase
    .from('settings')
    .update({ value, updated_at: now })
    .eq('key', key);


  if (onlyGlobal) {
    query = query.is('finance_company_id', null);
  } else if (financeCompanyId) {
    query = query.eq('finance_company_id', financeCompanyId);
  }


  const { data, error } = await query.select();
  if (error) throw error;
  return data || [];
};


const buildDefaultSettingPayload = ({ key, now, financeCompanyId = null }) => {
  const defaultMeta = DEFAULT_SETTINGS[key] || { value: '0', description: null };


  return {
    key,
    value: defaultMeta.value,
    description: defaultMeta.description,
    updated_at: now,
    finance_company_id: financeCompanyId,
  };
};


const ensureFinanceSettings = async (financeCompanyId) => {
  const now = new Date().toISOString();
  const desiredKeys = Object.keys(DEFAULT_SETTINGS);


  const { data: scopedSettings, error: scopedError } = await supabase
    .from('settings')
    .select('*')
    .eq('finance_company_id', financeCompanyId)
    .order('key');


  if (scopedError) throw scopedError;


  const existingKeys = new Set((scopedSettings || []).map((setting) => setting.key));
  const missingKeys = desiredKeys.filter((key) => !existingKeys.has(key));


  if (missingKeys.length === 0) {
    return scopedSettings || [];
  }


  const insertPayload = missingKeys.map((key) =>
    buildDefaultSettingPayload({ key, now, financeCompanyId })
  );


  const { error: insertError } = await supabase
    .from('settings')
    .insert(insertPayload);


  if (insertError) {
    throw new Error(
      'Finance settings are not isolated yet. Run the tenant settings migration to scope settings by finance company before continuing.'
    );
  }


  const { data: refreshedData, error: refreshedError } = await supabase
    .from('settings')
    .select('*')
    .eq('finance_company_id', financeCompanyId)
    .order('key');


  if (refreshedError) throw refreshedError;
  return refreshedData || [];
};


const insertSettingRow = async ({ key, value, now, financeCompanyId }) => {
  const insertPayload = {
    key,
    value,
    updated_at: now,
    finance_company_id: financeCompanyId || null,
  };


  return supabase
    .from('settings')
    .insert(insertPayload)
    .select();
};


/**
 * Get all settings
 */
export const getSettings = async () => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    return ensureFinanceSettings(currentUser.finance_company_id);
  }


  let query = supabase
    .from('settings')
    .select('*')
    .order('key');


  const { data, error } = await query;
 
  if (error) throw error;
  return data;
};


/**
 * Update setting
 */
export const updateSetting = async (key, value) => {
  const currentUser = getCurrentUser();
  const now = new Date().toISOString();
  const isFinanceUser = isFinanceRole(currentUser?.role);
  const financeCompanyId = currentUser?.finance_company_id || null;


  if (isFinanceUser && !financeCompanyId) {
    throw new Error('Access denied: No finance company assigned');
  }


  if (isFinanceUser) {
    const scopedUpdates = await updateSettingRows({
      key,
      value,
      now,
      financeCompanyId,
      onlyGlobal: false,
    });


    if (scopedUpdates.length > 0) {
      return scopedUpdates[0];
    }


    const defaultMeta = DEFAULT_SETTINGS[key] || { description: null };
    const insertPayload = {
      key,
      value,
      description: defaultMeta.description,
      updated_at: now,
      finance_company_id: financeCompanyId,
    };


    const { data: insertedData, error: insertError } = await supabase
      .from('settings')
      .insert(insertPayload)
      .select();


    if (insertError) {
      throw new Error(
        'Finance settings are not isolated yet. Run the tenant settings migration to scope settings by finance company before continuing.'
      );
    }


    return insertedData && insertedData.length > 0 ? insertedData[0] : null;
  }


  const scopedUpdates = await updateSettingRows({
    key,
    value,
    now,
    financeCompanyId: null,
    onlyGlobal: false,
  });
  if (scopedUpdates.length > 0) {
    return scopedUpdates[0];
  }


  const { data: insertedData, error: insertError } = await insertSettingRow({
    key,
    value,
    now,
    financeCompanyId: null,
  });


  if (insertError) {
    throw insertError;
  }


  return insertedData && insertedData.length > 0 ? insertedData[0] : null;
};


/**
 * Get setting by key
 */
export const getSettingByKey = async (key) => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return null;
  }


  let query = supabase
    .from('settings')
    .select('*')
    .eq('key', key);


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    const settings = await ensureFinanceSettings(currentUser.finance_company_id);
    return settings.find((setting) => setting.key === key) || null;
  }


  const { data, error } = await query.single();
 
  if (error) throw error;
  return data;
};