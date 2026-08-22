use std::env;
use std::fs;
use std::time::Instant;

use veritas_engine::{evaluate, Netlist, Node, NodeKind, Signal};

#[derive(Debug)]
struct Scenario {
    name: String,
    width: u8,
    iterations: usize,
    input_a: u64,
    input_b: u64,
    expected_output: u64,
}

fn parse_hex(value: &str) -> u64 {
    let cleaned = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
        .expect("fixture values must be hexadecimal");
    u64::from_str_radix(cleaned, 16).expect("fixture hexadecimal value must be valid")
}

fn load_scenarios(path: &str) -> Vec<Scenario> {
    fs::read_to_string(path)
        .expect("comparison fixture must be readable")
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with('#'))
        .map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            assert_eq!(fields.len(), 6, "comparison fixture rows have six fields");
            Scenario {
                name: fields[0].to_owned(),
                width: fields[1].parse().expect("fixture width must be numeric"),
                iterations: fields[2]
                    .parse()
                    .expect("fixture iterations must be numeric"),
                input_a: parse_hex(fields[3]),
                input_b: parse_hex(fields[4]),
                expected_output: parse_hex(fields[5]),
            }
        })
        .collect()
}

fn benchmark(scenario: &Scenario) -> (u64, u64, u128) {
    let a = Signal::new(scenario.width, scenario.input_a).expect("input_a must fit width");
    let b = Signal::new(scenario.width, scenario.input_b).expect("input_b must fit width");
    let netlist = Netlist {
        nodes: vec![
            Node::input("a", a),
            Node::input("b", b),
            Node::gate("and", NodeKind::And, vec!["a".into(), "b".into()]),
            Node::gate("xor", NodeKind::Xor, vec!["a".into(), "b".into()]),
            Node::gate("or", NodeKind::Or, vec!["and".into(), "xor".into()]),
            Node::gate("nand", NodeKind::Nand, vec!["and".into(), "or".into()]),
            Node::gate("xnor", NodeKind::Xnor, vec!["nand".into(), "xor".into()]),
            Node::gate("not", NodeKind::Not, vec!["xnor".into()]),
            Node::gate("out", NodeKind::Output, vec!["not".into()]),
        ],
    };

    for _ in 0..100 {
        let evaluation = evaluate(&netlist, &[]).expect("comparison netlist must evaluate");
        std::hint::black_box(evaluation.output("out").expect("output must exist").bits);
    }

    let started = Instant::now();
    let mut checksum = 0_u64;
    let mut output = 0_u64;
    for _ in 0..scenario.iterations {
        let evaluation = evaluate(&netlist, &[]).expect("comparison netlist must evaluate");
        output = evaluation.output("out").expect("output must exist").bits;
        checksum ^= output;
        std::hint::black_box(output);
    }
    (output, checksum, started.elapsed().as_nanos())
}

fn main() {
    let fixture = env::var("VERITAS_BENCHMARK_FIXTURE").expect("fixture path must be provided");
    let output_path = env::var("VERITAS_BENCHMARK_OUTPUT").expect("output path must be provided");
    let scenarios = load_scenarios(&fixture);
    let mut json = String::from(
        r#"{"runtime":"rust","mode":"cargo-bench-release","warmup_iterations":100,"scenarios":["#,
    );

    for (index, scenario) in scenarios.iter().enumerate() {
        let (output, checksum, elapsed_ns) = benchmark(scenario);
        assert_eq!(
            output, scenario.expected_output,
            "comparison output must match the fixture oracle"
        );
        if index > 0 {
            json.push(',');
        }
        json.push_str(&format!(
            r#"{{"name":"{}","width":{},"iterations":{},"expected_bits":"{}","output_bits":"{}","checksum":"{}","elapsed_ns":{}}}"#,
            scenario.name,
            scenario.width,
            scenario.iterations,
            scenario.expected_output,
            output,
            checksum,
            elapsed_ns
        ));
    }
    json.push_str("]}\n");
    fs::write(output_path, json).expect("benchmark output must be writable");
}
