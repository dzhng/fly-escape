# Closed-base sofa

The [catalogue](../catalog.json) owns the native envelope. Its closed floor base matches the physical rectangle rather than implying a route beneath the cushions. The grounded centre pivot uses glTF +Y up and +Z front.

[author.py](author.py) creates original geometry and separate asset/staging scenes. Only the asset is exported; stage cameras and lights cannot become game content. [Shared validation](../authoring.py) checks source and imported bounds without stretching. The [house finishing pipeline](../README.md) supplies production materials after shape authoring.

[Shape evidence](../../../specs/done/help-the-fly-escape/assets/evidence/21/sofa-prepared/README.md) preserves the neutral authoring views; [furnishing evidence](../../../specs/done/help-the-fly-escape/assets/evidence/20/furniture-identity/README.md) records loading and physical occupancy.
