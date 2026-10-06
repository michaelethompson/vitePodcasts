export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <p role="status" className="status">
      {what}, please wait…
    </p>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="error-box">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Segmented<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="segmented">
      <legend>{legend}</legend>
      <div className="segmented-row">
        {options.map((o) => (
          <label key={String(o.value)} className="segment">
            <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
