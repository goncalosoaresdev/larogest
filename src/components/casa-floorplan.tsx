export function CasaFloorPlan() {
  return (
    <svg className="casa-plan" viewBox="0 0 360 240" role="img" aria-hidden="true">
      <g className="casa-plan-iso" transform="translate(18 22) skewX(-16) scale(1 0.72)">
        <path className="casa-plan-slab" d="M28 214h304l18-16V42L332 26H28Z" />
        <path className="casa-plan-wall" d="M36 198h272V42H36Z" />
        <path className="casa-plan-wall" d="M36 42h168v86H36Z" />
        <path className="casa-plan-wall" d="M204 42h104v86H204Z" />
        <path className="casa-plan-wall" d="M36 128h176v70H36Z" />
        <path className="casa-plan-wall" d="M212 128h96v70H212Z" />

        <path className="casa-plan-furn" d="M52 156h78v18H52Z" />
        <path className="casa-plan-furn" d="M52 156v42h18" />
        <rect className="casa-plan-furn" x="92" y="168" width="28" height="18" rx="3" />
        <circle className="casa-plan-plant" cx="178" cy="168" r="7" />

        <rect className="casa-plan-furn" x="226" y="142" width="66" height="14" rx="2" />
        <rect className="casa-plan-furn" x="226" y="168" width="22" height="18" rx="2" />
        <rect className="casa-plan-furn" x="254" y="168" width="38" height="18" rx="2" />

        <rect className="casa-plan-furn" x="58" y="58" width="52" height="34" rx="3" />
        <rect className="casa-plan-furn" x="62" y="62" width="44" height="12" rx="2" />
        <rect className="casa-plan-furn" x="148" y="58" width="18" height="28" rx="2" />

        <rect className="casa-plan-furn" x="226" y="58" width="28" height="18" rx="9" />
        <rect className="casa-plan-furn" x="262" y="58" width="22" height="36" rx="3" />
        <circle className="casa-plan-plant" cx="248" cy="106" r="6" />

        <path className="casa-plan-door" d="M196 128v18" />
        <path className="casa-plan-door" d="M204 86h18" />
        <path className="casa-plan-door" d="M212 168h16" />
      </g>
    </svg>
  );
}
