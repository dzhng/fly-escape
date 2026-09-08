# Second-house movement pacing

Six new native attempts plus two reused identical empty controls, baseline518b184, seeds110/111. [Plans](plans.json) remove only the preceding route's near-spawn laundry and compare1×/2× walk and flight speeds; all geometry, fields and neural settings stay unchanged. Uses the [preceding harness](../second-house-route/second_house_pilot.rs); raw compact results are compressed under runs/.

| Setup | Escapes at1× | Escapes at2× |
| --- | --- | --- |
| Empty | 0,0 | 4,3 |
| Revised route | 0,2 | 3,3 |

Every run completed3000ticks. Double speed improves traversal in this small sample but does not make the tested placement plan outperform empty. Removing laundry alone also does not reliably improve on the preceding route's2,1escapes. No production pacing or threshold change is accepted from this comparison.

Root checked raw outcomes and frozen inputs. The empty1× controls are byte-identical copies of the preceding pilot; they are reuse, not new replication. Next test minimal arrangements at doorways before expanding the seed count. Player difficulty remains unmeasured.
