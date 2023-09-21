use yew::prelude::*;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub children: Children,
}

#[function_component(Grid)]
pub fn grid(props: &Props) -> Html {
    html! {
        <div class="relative scroll-smooth hover:scroll-auto overflow-x-auto shadow-md border dark:border-zinc-200 border-zinc-400 rounded-lg">
            <div class="flex items-center justify-between pb-4">
                <table class="w-full text-sm text-left text-zinc-400 dark:text-zinc-200 table-auto bg-white dark:bg-zinc-700 bg-opacity-30 dark:bg-opacity-30">
                { props.children.clone() }
                </table>
            </div>
        </div>
    }
}

#[function_component(Ghead)]
pub fn ghead(props: &Props) -> Html {
    html! {
        <thead class="text-xs uppercase dark:bg-zinc-500 dark:text-zinc-200 text-zinc-400 bg-opacity-30 dark:bg-opacity-30">
            <tr>
                { props.children.clone() }
            </tr>
        </thead>
    }
}

#[function_component(Gh)]
pub fn gh(props: &Props) -> Html {
    html! {
        <th scope="col" class="px-3 py-3">{ props.children.clone() }</th>
    }
}

#[function_component(Gbody)]
pub fn gbody(props: &Props) -> Html {
    html! {
        <tbody>{ props.children.clone() }</tbody>
    }
}

#[function_component(Gr)]
pub fn gr(props: &Props) -> Html {
    html! {
        <tr class="bg-white bg-opacity-40 dark:bg-opacity-40 dark:bg-zinc-800 dark:border-zinc-700 border-b hover:bg-zinc-50 dark:hover:bg-zinc-600">
            { props.children.clone() }
        </tr>
    }
}

#[function_component(Ghd)]
pub fn ghd(props: &Props) -> Html {
    html! {
        <th scope="row" class="flex items-center px-3 py-4 text-zinc-400 whitespace-nowrap dark:text-zinc-300">
            <div class="text-sm font-normal">{ props.children.clone() }</div>
        </th>
    }
}

#[function_component(Gd)]
pub fn gd(props: &Props) -> Html {
    html! {
        <td class="px-3 py-4">{ props.children.clone() }</td>
    }
}
