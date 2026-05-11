export function HelpTooltip({ text }: { text: string }) {
  return <span aria-hidden="true" className="help-tooltip" data-tooltip={text} />;
}
