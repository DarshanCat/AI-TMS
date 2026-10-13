import NomenclatureModule from "./NomenclatureModule";

export default function NomenclaturePage() {
  return (
    <div>
      <h1 className="page-title">Tool Nomenclature Standard</h1>
      <p className="page-sub">
        Universal Skeleton: &lt;TYPE&gt; &lt;FIELD 1&gt; &lt;FIELD 2&gt; &lt;NN&gt;. The nomenclature IS the Tool ID.
        Review standard types, ISO conventions, and test the interactive builder.
      </p>
      <NomenclatureModule />
    </div>
  );
}
