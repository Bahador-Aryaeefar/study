"use client";

import { RequestPath, Estimator, LoadBalancer, CacheSim, GatewayFlow } from "./network";
import { ConsistentHash, Replication, Quorum, Bloom, Queues, FanOut, Contention, Proximity } from "./data";
import { TokenBucket, CircuitBreaker, RetryStorm, Saga, Raft } from "./resilience";
import { RateLimitCompare } from "./ratelimit";
import { OptimizerLab, MatrixLab, KLLab, BiasVarianceLab, SoftmaxLab, SignificanceLab, BackpropLab, GD1DLab, KMeansLab } from "./math";
import { ConvLab, AttentionLab, BPELab, TrainMemLab, ScheduleLab } from "./dl";
import { Batching, KvCache, RagPipeline, AgentLoop } from "./ai";

const REGISTRY: Record<string, () => React.ReactElement> = {
  "request-path": () => <RequestPath />,
  estimator: () => <Estimator />,
  "load-balancer": () => <LoadBalancer />,
  cache: () => <CacheSim />,
  gateway: () => <GatewayFlow />,
  "consistent-hash": () => <ConsistentHash />,
  replication: () => <Replication />,
  quorum: () => <Quorum />,
  bloom: () => <Bloom />,
  queues: () => <Queues />,
  fanout: () => <FanOut />,
  contention: () => <Contention />,
  proximity: () => <Proximity />,
  "ratelimit-compare": () => <RateLimitCompare />,
  "token-bucket": () => <TokenBucket />,
  "circuit-breaker": () => <CircuitBreaker />,
  "retry-storm": () => <RetryStorm />,
  saga: () => <Saga />,
  raft: () => <Raft />,
  batching: () => <Batching />,
  "kv-cache": () => <KvCache />,
  "rag-pipeline": () => <RagPipeline />,
  "agent-loop": () => <AgentLoop />,
  "optimizer-lab": () => <OptimizerLab />,
  "matrix-lab": () => <MatrixLab />,
  "kl-lab": () => <KLLab />,
  "bias-variance": () => <BiasVarianceLab />,
  "softmax-lab": () => <SoftmaxLab />,
  "significance-lab": () => <SignificanceLab />,
  "backprop-lab": () => <BackpropLab />,
  "gd-1d": () => <GD1DLab />,
  "conv-lab": () => <ConvLab />,
  "attention-lab": () => <AttentionLab />,
  "bpe-lab": () => <BPELab />,
  "trainmem-lab": () => <TrainMemLab />,
  "schedule-lab": () => <ScheduleLab />,
  "kmeans-lab": () => <KMeansLab />,
};

export function VizByKey({ k }: { k: string }) {
  const f = REGISTRY[k];
  return f ? f() : null;
}
