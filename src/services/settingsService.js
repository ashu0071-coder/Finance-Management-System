import { supabase } from '../lib/supabase';


/**
 * Get all settings
 */
export const getSettings = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .order('key');
 
  if (error) throw error;
  return data;
};


/**
 * Update setting
 */
export const updateSetting = async (key, value) => {
  const now = new Date().toISOString();


  const { data, error } = await supabase
    .from('settings')
    .update({ value, updated_at: now })
    .eq('key', key)
    .select();
 
  if (error) throw error;


  if (data && data.length > 0) {
    return data[0];
  }


  const { data: insertedData, error: insertError } = await supabase
    .from('settings')
    .insert({ key, value, updated_at: now })
    .select();


  if (insertError) throw insertError;
  return insertedData && insertedData.length > 0 ? insertedData[0] : null;
};


/**
 * Get setting by key
 */
export const getSettingByKey = async (key) => {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('key', key)
    .single();
 
  if (error) throw error;
  return data;
};