use std::fs;

use veritas_engine::Signal;

fn signal(width: u8, bits: u64) -> Signal {
    Signal::new(width, bits).expect("fixture value must fit")
}

#[test]
fn shared_gate_fixture_matches_rust_semantics() {
    let fixture = fs::read_to_string("../tests/fixtures/rust-engine/gates.tsv")
        .expect("shared gate fixture must be available from crate root");

    for line in fixture
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
    {
        let fields: Vec<&str> = line.split('|').collect();
        assert_eq!(fields.len(), 10, "fixture row has 10 fields: {line}");
        let width: u8 = fields[1].parse().unwrap();
        let left = signal(width, fields[2].parse().unwrap());
        let right = signal(width, fields[3].parse().unwrap());
        let expected: Vec<u64> = fields[4..]
            .iter()
            .map(|value| value.parse().unwrap())
            .collect();
        let and = left.binary_and(right).expect("matching widths");
        let or = left.binary_or(right).expect("matching widths");
        let xor = left.binary_xor(right).expect("matching widths");
        let actual = [
            and.bits,
            and.not().bits,
            or.bits,
            or.not().bits,
            xor.bits,
            xor.not().bits,
        ];
        assert_eq!(
            actual,
            expected.as_slice(),
            "fixture row {id} diverged",
            id = fields[0]
        );
    }
}
