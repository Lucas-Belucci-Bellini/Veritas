use std::time::Instant;

use veritas_engine::{evaluate, Netlist, Node, NodeKind, Signal};

fn signal(width: u8, bits: u64) -> Signal {
    Signal::new(width, bits).expect("benchmark signal must fit")
}

fn main() {
    let netlist = Netlist {
        nodes: vec![
            Node::input("a", signal(32, 0x0f0f_0f0f)),
            Node::input("b", signal(32, 0xf0f0_f0f0)),
            Node::gate("and", NodeKind::And, vec!["a".into(), "b".into()]),
            Node::gate("xor", NodeKind::Xor, vec!["a".into(), "b".into()]),
            Node::gate("out", NodeKind::Output, vec!["xor".into()]),
        ],
    };
    let iterations = 100_000;
    let started = Instant::now();
    let mut checksum = 0_u64;
    for _ in 0..iterations {
        let evaluation = evaluate(&netlist, &[]).expect("benchmark netlist must evaluate");
        checksum ^= evaluation
            .output("out")
            .expect("benchmark output must exist")
            .bits;
    }
    let elapsed = started.elapsed();
    println!(
        "iterations={iterations} elapsed_ms={} checksum={checksum}",
        elapsed.as_millis()
    );
}
