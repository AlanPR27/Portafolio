(* ::Package:: *)





A = Import[SystemDialogInput["FileOpen"]];
A = ColorConvert[A, "Grayscale"];
A


B = ImageData[A];

Dimensions[B]

MatrixRank[B]


U = Part[SingularValueDecomposition[B], 1];
S = Part[SingularValueDecomposition[B], 2];
V = Part[SingularValueDecomposition[B], 3];

Dimensions[U]
Dimensions[S]
Dimensions[Transpose[V]]

U . S . Transpose[V];


M = {{-1, 0, -2}, {0, 1, 0}, {-2, 0, 2}};
SingularValueDecomposition[M]

Um = Part[SingularValueDecomposition[M], 1];
Sm = Part[SingularValueDecomposition[M], 2];
Vm = Part[SingularValueDecomposition[M], 3];
Vmt = Transpose[Vm]

Um . Sm . Vmt // MatrixForm

Transpose[Take[Transpose[Um],{1,1}]] . Partition[Take[Diagonal[Sm],{1,1}],1] . Take[Vmt,{1,1}] +
  Transpose[Take[Transpose[Um],{2,2}]] . Partition[Take[Diagonal[Sm],{2,2}],1] . Take[Vmt,{2,2}] +
  Transpose[Take[Transpose[Um],{3,3}]] . Partition[Take[Diagonal[Sm],{3,3}],1] . Take[Vmt,{3,3}] //
  MatrixForm


(* k = 3 *)
AA =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}];
Image[AA]

(* k = 6 *)
BB =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}] +
  Transpose[Take[Transpose[U],{4,4}]] . Partition[Take[Diagonal[S],{4,4}],1] . Take[Transpose[V],{4,4}] +
  Transpose[Take[Transpose[U],{5,5}]] . Partition[Take[Diagonal[S],{5,5}],1] . Take[Transpose[V],{5,5}] +
  Transpose[Take[Transpose[U],{6,6}]] . Partition[Take[Diagonal[S],{6,6}],1] . Take[Transpose[V],{6,6}];
Image[BB]

(* k = 8 *)
BBB =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}] +
  Transpose[Take[Transpose[U],{4,4}]] . Partition[Take[Diagonal[S],{4,4}],1] . Take[Transpose[V],{4,4}] +
  Transpose[Take[Transpose[U],{5,5}]] . Partition[Take[Diagonal[S],{5,5}],1] . Take[Transpose[V],{5,5}] +
  Transpose[Take[Transpose[U],{6,6}]] . Partition[Take[Diagonal[S],{6,6}],1] . Take[Transpose[V],{6,6}] +
  Transpose[Take[Transpose[U],{7,7}]] . Partition[Take[Diagonal[S],{7,7}],1] . Take[Transpose[V],{7,7}] +
  Transpose[Take[Transpose[U],{8,8}]] . Partition[Take[Diagonal[S],{8,8}],1] . Take[Transpose[V],{8,8}];
Image[BBB]

(* k = 10 *)
B10 =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}] +
  Transpose[Take[Transpose[U],{4,4}]] . Partition[Take[Diagonal[S],{4,4}],1] . Take[Transpose[V],{4,4}] +
  Transpose[Take[Transpose[U],{5,5}]] . Partition[Take[Diagonal[S],{5,5}],1] . Take[Transpose[V],{5,5}] +
  Transpose[Take[Transpose[U],{6,6}]] . Partition[Take[Diagonal[S],{6,6}],1] . Take[Transpose[V],{6,6}] +
  Transpose[Take[Transpose[U],{7,7}]] . Partition[Take[Diagonal[S],{7,7}],1] . Take[Transpose[V],{7,7}] +
  Transpose[Take[Transpose[U],{8,8}]] . Partition[Take[Diagonal[S],{8,8}],1] . Take[Transpose[V],{8,8}] +
  Transpose[Take[Transpose[U],{9,9}]] . Partition[Take[Diagonal[S],{9,9}],1] . Take[Transpose[V],{9,9}] +
  Transpose[Take[Transpose[U],{10,10}]] . Partition[Take[Diagonal[S],{10,10}],1] . Take[Transpose[V],{10,10}];
Image[B10]

(* k = 12 *)
B12 =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}] +
  Transpose[Take[Transpose[U],{4,4}]] . Partition[Take[Diagonal[S],{4,4}],1] . Take[Transpose[V],{4,4}] +
  Transpose[Take[Transpose[U],{5,5}]] . Partition[Take[Diagonal[S],{5,5}],1] . Take[Transpose[V],{5,5}] +
  Transpose[Take[Transpose[U],{6,6}]] . Partition[Take[Diagonal[S],{6,6}],1] . Take[Transpose[V],{6,6}] +
  Transpose[Take[Transpose[U],{7,7}]] . Partition[Take[Diagonal[S],{7,7}],1] . Take[Transpose[V],{7,7}] +
  Transpose[Take[Transpose[U],{8,8}]] . Partition[Take[Diagonal[S],{8,8}],1] . Take[Transpose[V],{8,8}] +
  Transpose[Take[Transpose[U],{9,9}]] . Partition[Take[Diagonal[S],{9,9}],1] . Take[Transpose[V],{9,9}] +
  Transpose[Take[Transpose[U],{10,10}]] . Partition[Take[Diagonal[S],{10,10}],1] . Take[Transpose[V],{10,10}] +
  Transpose[Take[Transpose[U],{11,11}]] . Partition[Take[Diagonal[S],{11,11}],1] . Take[Transpose[V],{11,11}] +
  Transpose[Take[Transpose[U],{12,12}]] . Partition[Take[Diagonal[S],{12,12}],1] . Take[Transpose[V],{12,12}];
Image[B12]

(* k = 14 *)
B14 =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}] +
  Transpose[Take[Transpose[U],{4,4}]] . Partition[Take[Diagonal[S],{4,4}],1] . Take[Transpose[V],{4,4}] +
  Transpose[Take[Transpose[U],{5,5}]] . Partition[Take[Diagonal[S],{5,5}],1] . Take[Transpose[V],{5,5}] +
  Transpose[Take[Transpose[U],{6,6}]] . Partition[Take[Diagonal[S],{6,6}],1] . Take[Transpose[V],{6,6}] +
  Transpose[Take[Transpose[U],{7,7}]] . Partition[Take[Diagonal[S],{7,7}],1] . Take[Transpose[V],{7,7}] +
  Transpose[Take[Transpose[U],{8,8}]] . Partition[Take[Diagonal[S],{8,8}],1] . Take[Transpose[V],{8,8}] +
  Transpose[Take[Transpose[U],{9,9}]] . Partition[Take[Diagonal[S],{9,9}],1] . Take[Transpose[V],{9,9}] +
  Transpose[Take[Transpose[U],{10,10}]] . Partition[Take[Diagonal[S],{10,10}],1] . Take[Transpose[V],{10,10}] +
  Transpose[Take[Transpose[U],{11,11}]] . Partition[Take[Diagonal[S],{11,11}],1] . Take[Transpose[V],{11,11}] +
  Transpose[Take[Transpose[U],{12,12}]] . Partition[Take[Diagonal[S],{12,12}],1] . Take[Transpose[V],{12,12}] +
  Transpose[Take[Transpose[U],{13,13}]] . Partition[Take[Diagonal[S],{13,13}],1] . Take[Transpose[V],{13,13}] +
  Transpose[Take[Transpose[U],{14,14}]] . Partition[Take[Diagonal[S],{14,14}],1] . Take[Transpose[V],{14,14}];
Image[B14]

(* k = 24 *)
B24 =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}] +
  Transpose[Take[Transpose[U],{4,4}]] . Partition[Take[Diagonal[S],{4,4}],1] . Take[Transpose[V],{4,4}] +
  Transpose[Take[Transpose[U],{5,5}]] . Partition[Take[Diagonal[S],{5,5}],1] . Take[Transpose[V],{5,5}] +
  Transpose[Take[Transpose[U],{6,6}]] . Partition[Take[Diagonal[S],{6,6}],1] . Take[Transpose[V],{6,6}] +
  Transpose[Take[Transpose[U],{7,7}]] . Partition[Take[Diagonal[S],{7,7}],1] . Take[Transpose[V],{7,7}] +
  Transpose[Take[Transpose[U],{8,8}]] . Partition[Take[Diagonal[S],{8,8}],1] . Take[Transpose[V],{8,8}] +
  Transpose[Take[Transpose[U],{9,9}]] . Partition[Take[Diagonal[S],{9,9}],1] . Take[Transpose[V],{9,9}] +
  Transpose[Take[Transpose[U],{10,10}]] . Partition[Take[Diagonal[S],{10,10}],1] . Take[Transpose[V],{10,10}] +
  Transpose[Take[Transpose[U],{11,11}]] . Partition[Take[Diagonal[S],{11,11}],1] . Take[Transpose[V],{11,11}] +
  Transpose[Take[Transpose[U],{12,12}]] . Partition[Take[Diagonal[S],{12,12}],1] . Take[Transpose[V],{12,12}] +
  Transpose[Take[Transpose[U],{13,13}]] . Partition[Take[Diagonal[S],{13,13}],1] . Take[Transpose[V],{13,13}] +
  Transpose[Take[Transpose[U],{14,14}]] . Partition[Take[Diagonal[S],{14,14}],1] . Take[Transpose[V],{14,14}] +
  Transpose[Take[Transpose[U],{15,15}]] . Partition[Take[Diagonal[S],{15,15}],1] . Take[Transpose[V],{15,15}] +
  Transpose[Take[Transpose[U],{16,16}]] . Partition[Take[Diagonal[S],{16,16}],1] . Take[Transpose[V],{16,16}] +
  Transpose[Take[Transpose[U],{17,17}]] . Partition[Take[Diagonal[S],{17,17}],1] . Take[Transpose[V],{17,17}] +
  Transpose[Take[Transpose[U],{18,18}]] . Partition[Take[Diagonal[S],{18,18}],1] . Take[Transpose[V],{18,18}] +
  Transpose[Take[Transpose[U],{19,19}]] . Partition[Take[Diagonal[S],{19,19}],1] . Take[Transpose[V],{19,19}] +
  Transpose[Take[Transpose[U],{20,20}]] . Partition[Take[Diagonal[S],{20,20}],1] . Take[Transpose[V],{20,20}] +
  Transpose[Take[Transpose[U],{21,21}]] . Partition[Take[Diagonal[S],{21,21}],1] . Take[Transpose[V],{21,21}] +
  Transpose[Take[Transpose[U],{22,22}]] . Partition[Take[Diagonal[S],{22,22}],1] . Take[Transpose[V],{22,22}] +
  Transpose[Take[Transpose[U],{23,23}]] . Partition[Take[Diagonal[S],{23,23}],1] . Take[Transpose[V],{23,23}] +
  Transpose[Take[Transpose[U],{24,24}]] . Partition[Take[Diagonal[S],{24,24}],1] . Take[Transpose[V],{24,24}];
Image[B24]

(* k = 34 *)
B34 =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}] +
  Transpose[Take[Transpose[U],{4,4}]] . Partition[Take[Diagonal[S],{4,4}],1] . Take[Transpose[V],{4,4}] +
  Transpose[Take[Transpose[U],{5,5}]] . Partition[Take[Diagonal[S],{5,5}],1] . Take[Transpose[V],{5,5}] +
  Transpose[Take[Transpose[U],{6,6}]] . Partition[Take[Diagonal[S],{6,6}],1] . Take[Transpose[V],{6,6}] +
  Transpose[Take[Transpose[U],{7,7}]] . Partition[Take[Diagonal[S],{7,7}],1] . Take[Transpose[V],{7,7}] +
  Transpose[Take[Transpose[U],{8,8}]] . Partition[Take[Diagonal[S],{8,8}],1] . Take[Transpose[V],{8,8}] +
  Transpose[Take[Transpose[U],{9,9}]] . Partition[Take[Diagonal[S],{9,9}],1] . Take[Transpose[V],{9,9}] +
  Transpose[Take[Transpose[U],{10,10}]] . Partition[Take[Diagonal[S],{10,10}],1] . Take[Transpose[V],{10,10}] +
  Transpose[Take[Transpose[U],{11,11}]] . Partition[Take[Diagonal[S],{11,11}],1] . Take[Transpose[V],{11,11}] +
  Transpose[Take[Transpose[U],{12,12}]] . Partition[Take[Diagonal[S],{12,12}],1] . Take[Transpose[V],{12,12}] +
  Transpose[Take[Transpose[U],{13,13}]] . Partition[Take[Diagonal[S],{13,13}],1] . Take[Transpose[V],{13,13}] +
  Transpose[Take[Transpose[U],{14,14}]] . Partition[Take[Diagonal[S],{14,14}],1] . Take[Transpose[V],{14,14}] +
  Transpose[Take[Transpose[U],{15,15}]] . Partition[Take[Diagonal[S],{15,15}],1] . Take[Transpose[V],{15,15}] +
  Transpose[Take[Transpose[U],{16,16}]] . Partition[Take[Diagonal[S],{16,16}],1] . Take[Transpose[V],{16,16}] +
  Transpose[Take[Transpose[U],{17,17}]] . Partition[Take[Diagonal[S],{17,17}],1] . Take[Transpose[V],{17,17}] +
  Transpose[Take[Transpose[U],{18,18}]] . Partition[Take[Diagonal[S],{18,18}],1] . Take[Transpose[V],{18,18}] +
  Transpose[Take[Transpose[U],{19,19}]] . Partition[Take[Diagonal[S],{19,19}],1] . Take[Transpose[V],{19,19}] +
  Transpose[Take[Transpose[U],{20,20}]] . Partition[Take[Diagonal[S],{20,20}],1] . Take[Transpose[V],{20,20}] +
  Transpose[Take[Transpose[U],{21,21}]] . Partition[Take[Diagonal[S],{21,21}],1] . Take[Transpose[V],{21,21}] +
  Transpose[Take[Transpose[U],{22,22}]] . Partition[Take[Diagonal[S],{22,22}],1] . Take[Transpose[V],{22,22}] +
  Transpose[Take[Transpose[U],{23,23}]] . Partition[Take[Diagonal[S],{23,23}],1] . Take[Transpose[V],{23,23}] +
  Transpose[Take[Transpose[U],{24,24}]] . Partition[Take[Diagonal[S],{24,24}],1] . Take[Transpose[V],{24,24}] +
  Transpose[Take[Transpose[U],{25,25}]] . Partition[Take[Diagonal[S],{25,25}],1] . Take[Transpose[V],{25,25}] +
  Transpose[Take[Transpose[U],{26,26}]] . Partition[Take[Diagonal[S],{26,26}],1] . Take[Transpose[V],{26,26}] +
  Transpose[Take[Transpose[U],{27,27}]] . Partition[Take[Diagonal[S],{27,27}],1] . Take[Transpose[V],{27,27}] +
  Transpose[Take[Transpose[U],{28,28}]] . Partition[Take[Diagonal[S],{28,28}],1] . Take[Transpose[V],{28,28}] +
  Transpose[Take[Transpose[U],{29,29}]] . Partition[Take[Diagonal[S],{29,29}],1] . Take[Transpose[V],{29,29}] +
  Transpose[Take[Transpose[U],{30,30}]] . Partition[Take[Diagonal[S],{30,30}],1] . Take[Transpose[V],{30,30}] +
  Transpose[Take[Transpose[U],{31,31}]] . Partition[Take[Diagonal[S],{31,31}],1] . Take[Transpose[V],{31,31}] +
  Transpose[Take[Transpose[U],{32,32}]] . Partition[Take[Diagonal[S],{32,32}],1] . Take[Transpose[V],{32,32}] +
  Transpose[Take[Transpose[U],{33,33}]] . Partition[Take[Diagonal[S],{33,33}],1] . Take[Transpose[V],{33,33}] +
  Transpose[Take[Transpose[U],{34,34}]] . Partition[Take[Diagonal[S],{34,34}],1] . Take[Transpose[V],{34,34}];
Image[B34]

(* k = 42 *)
B42 =
  Transpose[Take[Transpose[U],{1,1}]] . Partition[Take[Diagonal[S],{1,1}],1] . Take[Transpose[V],{1,1}] +
  Transpose[Take[Transpose[U],{2,2}]] . Partition[Take[Diagonal[S],{2,2}],1] . Take[Transpose[V],{2,2}] +
  Transpose[Take[Transpose[U],{3,3}]] . Partition[Take[Diagonal[S],{3,3}],1] . Take[Transpose[V],{3,3}] +
  Transpose[Take[Transpose[U],{4,4}]] . Partition[Take[Diagonal[S],{4,4}],1] . Take[Transpose[V],{4,4}] +
  Transpose[Take[Transpose[U],{5,5}]] . Partition[Take[Diagonal[S],{5,5}],1] . Take[Transpose[V],{5,5}] +
  Transpose[Take[Transpose[U],{6,6}]] . Partition[Take[Diagonal[S],{6,6}],1] . Take[Transpose[V],{6,6}] +
  Transpose[Take[Transpose[U],{7,7}]] . Partition[Take[Diagonal[S],{7,7}],1] . Take[Transpose[V],{7,7}] +
  Transpose[Take[Transpose[U],{8,8}]] . Partition[Take[Diagonal[S],{8,8}],1] . Take[Transpose[V],{8,8}] +
  Transpose[Take[Transpose[U],{9,9}]] . Partition[Take[Diagonal[S],{9,9}],1] . Take[Transpose[V],{9,9}] +
  Transpose[Take[Transpose[U],{10,10}]] . Partition[Take[Diagonal[S],{10,10}],1] . Take[Transpose[V],{10,10}] +
  Transpose[Take[Transpose[U],{11,11}]] . Partition[Take[Diagonal[S],{11,11}],1] . Take[Transpose[V],{11,11}] +
  Transpose[Take[Transpose[U],{12,12}]] . Partition[Take[Diagonal[S],{12,12}],1] . Take[Transpose[V],{12,12}] +
  Transpose[Take[Transpose[U],{13,13}]] . Partition[Take[Diagonal[S],{13,13}],1] . Take[Transpose[V],{13,13}] +
  Transpose[Take[Transpose[U],{14,14}]] . Partition[Take[Diagonal[S],{14,14}],1] . Take[Transpose[V],{14,14}] +
  Transpose[Take[Transpose[U],{15,15}]] . Partition[Take[Diagonal[S],{15,15}],1] . Take[Transpose[V],{15,15}] +
  Transpose[Take[Transpose[U],{16,16}]] . Partition[Take[Diagonal[S],{16,16}],1] . Take[Transpose[V],{16,16}] +
  Transpose[Take[Transpose[U],{17,17}]] . Partition[Take[Diagonal[S],{17,17}],1] . Take[Transpose[V],{17,17}] +
  Transpose[Take[Transpose[U],{18,18}]] . Partition[Take[Diagonal[S],{18,18}],1] . Take[Transpose[V],{18,18}] +
  Transpose[Take[Transpose[U],{19,19}]] . Partition[Take[Diagonal[S],{19,19}],1] . Take[Transpose[V],{19,19}] +
  Transpose[Take[Transpose[U],{20,20}]] . Partition[Take[Diagonal[S],{20,20}],1] . Take[Transpose[V],{20,20}] +
  Transpose[Take[Transpose[U],{21,21}]] . Partition[Take[Diagonal[S],{21,21}],1] . Take[Transpose[V],{21,21}] +
  Transpose[Take[Transpose[U],{22,22}]] . Partition[Take[Diagonal[S],{22,22}],1] . Take[Transpose[V],{22,22}] +
  Transpose[Take[Transpose[U],{23,23}]] . Partition[Take[Diagonal[S],{23,23}],1] . Take[Transpose[V],{23,23}] +
  Transpose[Take[Transpose[U],{24,24}]] . Partition[Take[Diagonal[S],{24,24}],1] . Take[Transpose[V],{24,24}] +
  Transpose[Take[Transpose[U],{25,25}]] . Partition[Take[Diagonal[S],{25,25}],1] . Take[Transpose[V],{25,25}] +
  Transpose[Take[Transpose[U],{26,26}]] . Partition[Take[Diagonal[S],{26,26}],1] . Take[Transpose[V],{26,26}] +
  Transpose[Take[Transpose[U],{27,27}]] . Partition[Take[Diagonal[S],{27,27}],1] . Take[Transpose[V],{27,27}] +
  Transpose[Take[Transpose[U],{28,28}]] . Partition[Take[Diagonal[S],{28,28}],1] . Take[Transpose[V],{28,28}] +
  Transpose[Take[Transpose[U],{29,29}]] . Partition[Take[Diagonal[S],{29,29}],1] . Take[Transpose[V],{29,29}] +
  Transpose[Take[Transpose[U],{30,30}]] . Partition[Take[Diagonal[S],{30,30}],1] . Take[Transpose[V],{30,30}] +
  Transpose[Take[Transpose[U],{31,31}]] . Partition[Take[Diagonal[S],{31,31}],1] . Take[Transpose[V],{31,31}] +
  Transpose[Take[Transpose[U],{32,32}]] . Partition[Take[Diagonal[S],{32,32}],1] . Take[Transpose[V],{32,32}] +
  Transpose[Take[Transpose[U],{33,33}]] . Partition[Take[Diagonal[S],{33,33}],1] . Take[Transpose[V],{33,33}] +
  Transpose[Take[Transpose[U],{34,34}]] . Partition[Take[Diagonal[S],{34,34}],1] . Take[Transpose[V],{34,34}] +
  Transpose[Take[Transpose[U],{35,35}]] . Partition[Take[Diagonal[S],{35,35}],1] . Take[Transpose[V],{35,35}] +
  Transpose[Take[Transpose[U],{36,36}]] . Partition[Take[Diagonal[S],{36,36}],1] . Take[Transpose[V],{36,36}] +
  Transpose[Take[Transpose[U],{37,37}]] . Partition[Take[Diagonal[S],{37,37}],1] . Take[Transpose[V],{37,37}] +
  Transpose[Take[Transpose[U],{38,38}]] . Partition[Take[Diagonal[S],{38,38}],1] . Take[Transpose[V],{38,38}] +
  Transpose[Take[Transpose[U],{39,39}]] . Partition[Take[Diagonal[S],{39,39}],1] . Take[Transpose[V],{39,39}] +
  Transpose[Take[Transpose[U],{40,40}]] . Partition[Take[Diagonal[S],{40,40}],1] . Take[Transpose[V],{40,40}] +
  Transpose[Take[Transpose[U],{41,41}]] . Partition[Take[Diagonal[S],{41,41}],1] . Take[Transpose[V],{41,41}] +
  Transpose[Take[Transpose[U],{42,42}]] . Partition[Take[Diagonal[S],{42,42}],1] . Take[Transpose[V],{42,42}];
Image[B42]




