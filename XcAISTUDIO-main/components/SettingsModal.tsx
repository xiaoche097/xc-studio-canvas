import React, { useEffect, useState } from 'react';
import { Key, Save, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProviderFields {
  seedanceKey: string;
  seedanceBaseUrl: string;
  seedanceModel: string;
  wanKey: string;
  wanBaseUrl: string;
  wanModel: string;
}

const defaults: ProviderFields = {
  seedanceKey: '',
  seedanceBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  seedanceModel: 'seedance-2.0',
  wanKey: '',
  wanBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
  wanModel: 'wan2.1-t2v-turbo',
};

const Field = ({
  label,
  value,
  onChange,
  secret = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
  placeholder?: string;
}) => (
  <label className="block space-y-2">
    <span className="text-[11px] font-bold text-zinc-400">{label}</span>
    <input
      type={secret ? 'password' : 'text'}
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onChange={event => onChange(event.target.value)}
      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-400/50"
    />
  </label>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [fields, setFields] = useState(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFields({
      seedanceKey: localStorage.getItem('seedance_api_key') || '',
      seedanceBaseUrl: localStorage.getItem('seedance_base_url') || defaults.seedanceBaseUrl,
      seedanceModel: localStorage.getItem('seedance_model') || defaults.seedanceModel,
      wanKey: localStorage.getItem('wan_api_key') || '',
      wanBaseUrl: localStorage.getItem('wan_base_url') || defaults.wanBaseUrl,
      wanModel: localStorage.getItem('wan_model') || defaults.wanModel,
    });
  }, [isOpen]);

  const update = (key: keyof ProviderFields, value: string) => {
    setFields(current => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('seedance_api_key', fields.seedanceKey.trim());
    localStorage.setItem('seedance_base_url', fields.seedanceBaseUrl.trim());
    localStorage.setItem('seedance_model', fields.seedanceModel.trim());
    localStorage.setItem('wan_api_key', fields.wanKey.trim());
    localStorage.setItem('wan_base_url', fields.wanBaseUrl.trim());
    localStorage.setItem('wan_model', fields.wanModel.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[86vh] w-[560px] overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e] shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Key size={16} />
            视频模型接入
          </div>
          <button onClick={onClose} className="text-zinc-500 transition-colors hover:text-white"><X size={18} /></button>
        </div>

        <div className="max-h-[68vh] space-y-5 overflow-y-auto p-6">
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div>
              <h3 className="text-sm font-bold text-white">Seedance / 火山方舟</h3>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">支持文生视频、首帧、首尾帧与多参考素材。模型 ID 可按方舟控制台实际开通的接入点修改。</p>
            </div>
            <Field label="API Key" secret value={fields.seedanceKey} onChange={value => update('seedanceKey', value)} placeholder="输入火山方舟 API Key" />
            <Field label="Base URL" value={fields.seedanceBaseUrl} onChange={value => update('seedanceBaseUrl', value)} />
            <Field label="模型 / Endpoint ID" value={fields.seedanceModel} onChange={value => update('seedanceModel', value)} />
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div>
              <h3 className="text-sm font-bold text-white">Wan / DashScope</h3>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">支持文生视频和图生视频。图生视频时会自动使用上传或连接的首帧。</p>
            </div>
            <Field label="API Key" secret value={fields.wanKey} onChange={value => update('wanKey', value)} placeholder="输入 DashScope API Key" />
            <Field label="Base URL" value={fields.wanBaseUrl} onChange={value => update('wanBaseUrl', value)} />
            <Field label="默认模型 ID" value={fields.wanModel} onChange={value => update('wanModel', value)} />
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 bg-[#121214] p-4">
          <span className="text-[10px] text-zinc-600">密钥仅保存在当前浏览器本地。</span>
          <button onClick={handleSave} className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold transition-colors ${saved ? 'bg-emerald-500 text-white' : 'bg-white text-black hover:bg-emerald-300'}`}>
            <Save size={13} />
            {saved ? '已保存' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
};
