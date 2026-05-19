function ProfileInput({ disabled, error, field, onChange, value }) {
  return (
    <label className="grid gap-1 text-sm font-medium" htmlFor={field.id}>
      {field.label}
      <input
        aria-invalid={Boolean(error)}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        disabled={disabled}
        id={field.id}
        name={field.id}
        onChange={onChange}
        type={field.type}
        value={value}
      />
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

export default ProfileInput
