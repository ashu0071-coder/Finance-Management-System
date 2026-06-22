import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';


const FINANCE_ROLES = new Set(['finance', 'finance_manager', 'finance_member']);


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


const tryFinanceLegacyUpdate = async ({ isFinanceUser, key, value, now, onlyGlobal }) => {
  if (!isFinanceUser) {
    return [];
  }


  return updateSettingRows({
    key,
    value,
    now,
    financeCompanyId: null,
    onlyGlobal,
  });
};


/**
 * Get all settings
 */
export const getSettings = async () => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }


  let query = supabase
    .from('settings')
    .select('*')
    .order('key');


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('finance_company_id', currentUser.finance_company_id);


    const { data, error } = await query;
    if (error) throw error;


    if (data && data.length > 0) {
      return data;
    }


    // Backward compatibility: legacy deployments keep a single global settings row per key.
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('settings')
      .select('*')
      .is('finance_company_id', null)
      .order('key');


    if (fallbackError) throw fallbackError;
    return fallbackData || [];
  }


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


  const scopedUpdates = await updateSettingRows({
    key,
    value,
    now,
    financeCompanyId: isFinanceUser ? financeCompanyId : null,
    onlyGlobal: false,
  });
  if (scopedUpdates.length > 0) {
    return scopedUpdates[0];
  }


  // Backward compatibility: if no tenant-scoped row exists, update the legacy global row.
  const legacyUpdates = await tryFinanceLegacyUpdate({
    isFinanceUser,
    key,
    value,
    now,
    onlyGlobal: true,
  });
  if (legacyUpdates.length > 0) {
    return legacyUpdates[0];
  }


  const { data: insertedData, error: insertError } = await insertSettingRow({
    key,
    value,
    now,
    financeCompanyId: isFinanceUser ? financeCompanyId : null,
  });


  if (!insertError) {
    return insertedData && insertedData.length > 0 ? insertedData[0] : null;
  }


  if (!isFinanceUser) {
    throw insertError;
  }


  // Backward compatibility: unique key constraint on legacy schema prevents tenant inserts.
  const fallbackUpdates = await tryFinanceLegacyUpdate({
    isFinanceUser,
    key,
    value,
    now,
    onlyGlobal: false,
  });
  return fallbackUpdates.length > 0 ? fallbackUpdates[0] : null;
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
    query = query.eq('finance_company_id', currentUser.finance_company_id);


    const { data, error } = await query.single();
    if (!error) {
      return data;
    }


    const { data: fallbackData, error: fallbackError } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .is('finance_company_id', null)
      .single();


    if (fallbackError) throw fallbackError;
    return fallbackData;
  }


  const { data, error } = await query.single();
 
  if (error) throw error;
  return data;
};