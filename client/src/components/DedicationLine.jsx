// One short sentence. Gender-neutral closing because we don't store gender.
function DedicationLine({ dedication }) {
  const names = dedication?.dedicated?.map(d => d.name) || [];
  if (names.length === 0) return null;
  return (
    <p className="dedication-line">
      🤲 هذه الختمة إهداءً إلى روح {names.join(' و ')}، رحمة الله على موتانا جميعًا.
    </p>
  );
}

export default DedicationLine;
